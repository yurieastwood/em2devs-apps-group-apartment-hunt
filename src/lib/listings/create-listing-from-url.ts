import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { fetchListing } from "../extract/fetch-listing";
import { parseApartmentList } from "../extract/parsers/apartmentlist";
import { parseApartments } from "../extract/parsers/apartments";
import { parseZillow } from "../extract/parsers/zillow";
import type { ParsedListing } from "../extract/types";
import { rehostListingPhotos } from "./rehost-photos";

type Parser = (url: string, html: string) => ParsedListing;

const PARSERS: Record<string, Parser> = {
  "zillow.com": parseZillow,
  "apartments.com": parseApartments,
  "apartmentlist.com": parseApartmentList,
};

export type CreateListingError =
  | { kind: "invalid_url"; message: string }
  | { kind: "unsupported_host"; host: string }
  | { kind: "fetch_failed"; status: number; triedProfiles: string[] }
  | { kind: "duplicate"; existingId: string }
  | { kind: "unknown"; message: string };

export type CreateListingResult =
  | { ok: true; id: string }
  | { ok: false; error: CreateListingError };

function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

export async function createListingFromUrl(
  rawUrl: string,
  ownerClerkUserId: string,
): Promise<CreateListingResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      error: { kind: "invalid_url", message: "not a valid URL" },
    };
  }

  const host = normalizeHost(parsedUrl.hostname);
  const parser = PARSERS[host];
  if (!parser) {
    return { ok: false, error: { kind: "unsupported_host", host } };
  }

  const sourceUrl = parsedUrl.toString();

  const existing = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.sourceUrl, sourceUrl))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      error: { kind: "duplicate", existingId: existing[0].id },
    };
  }

  const fetched = await fetchListing(sourceUrl);
  if (fetched.status !== 200) {
    return {
      ok: false,
      error: {
        kind: "fetch_failed",
        status: fetched.status,
        triedProfiles: fetched.triedProfiles,
      },
    };
  }

  const parsed = parser(sourceUrl, fetched.html);

  const [inserted] = await db
    .insert(listings)
    .values({
      ownerClerkUserId,
      sourceUrl: parsed.sourceUrl,
      sourceHost: parsed.sourceHost,
      sourceListingId: parsed.sourceListingId,
      title: parsed.title,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      latitude: parsed.latitude?.toString() ?? null,
      longitude: parsed.longitude?.toString() ?? null,
      bedrooms: parsed.bedrooms?.toString() ?? null,
      bathrooms: parsed.bathrooms?.toString() ?? null,
      squareFeet: parsed.squareFeet,
      priceUsd: parsed.priceUsd,
      description: parsed.description,
      raw: parsed.raw,
    })
    .returning({ id: listings.id });

  const { photos: rehosted, errors: photoErrors } = await rehostListingPhotos(
    inserted.id,
    parsed.photos,
  );
  if (rehosted.length > 0) {
    await db.insert(listingPhotos).values(
      rehosted.map((p) => ({
        listingId: inserted.id,
        sortOrder: p.sortOrder,
        r2Key: p.r2Key,
        originalUrl: p.originalUrl,
        contentType: p.contentType,
        width: p.width ?? null,
        height: p.height ?? null,
      })),
    );
  }
  if (photoErrors.length > 0) {
    await db
      .update(listings)
      .set({
        raw: { ...(parsed.raw as object), photoErrors: photoErrors.slice(0, 10) },
      })
      .where(eq(listings.id, inserted.id));
  }

  return { ok: true, id: inserted.id };
}
