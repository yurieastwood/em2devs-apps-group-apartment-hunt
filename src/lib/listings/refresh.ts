import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges, listings, type Listing } from "@/db/schema";
import { fetchListing } from "../extract/fetch-listing";
import { parseApartmentList } from "../extract/parsers/apartmentlist";
import { parseApartments } from "../extract/parsers/apartments";
import { parseZillow } from "../extract/parsers/zillow";
import type { Availability, ParsedListing } from "../extract/types";
import { resolveNeighborhood } from "./resolve-neighborhood";

type Parser = (url: string, html: string) => ParsedListing;

const PARSERS: Record<string, Parser> = {
  "zillow.com": parseZillow,
  "apartments.com": parseApartments,
  "apartmentlist.com": parseApartmentList,
};

export type RefreshSource = "cron" | "manual";

export type RefreshOutcome =
  | { kind: "ok"; changes: number; listingId: string }
  | { kind: "not_found" }
  | { kind: "unsupported_host"; host: string }
  | { kind: "fetch_failed"; status: number; triedProfiles: string[] };

export type RefreshChange = {
  field: "price" | "availability";
  oldValue: string | null;
  newValue: string | null;
};

function diffListing(
  current: Listing,
  parsedPrice: number | null,
  parsedAvailability: Availability,
): RefreshChange[] {
  const out: RefreshChange[] = [];
  if (current.priceUsd !== parsedPrice) {
    out.push({
      field: "price",
      oldValue: current.priceUsd != null ? String(current.priceUsd) : null,
      newValue: parsedPrice != null ? String(parsedPrice) : null,
    });
  }
  if (current.availability !== parsedAvailability) {
    out.push({
      field: "availability",
      oldValue: current.availability,
      newValue: parsedAvailability,
    });
  }
  return out;
}

export async function refreshListing(
  listingId: string,
  source: RefreshSource,
): Promise<RefreshOutcome> {
  const [current] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!current) return { kind: "not_found" };

  const parser = PARSERS[current.sourceHost];
  if (!parser) {
    return { kind: "unsupported_host", host: current.sourceHost };
  }

  const fetched = await fetchListing(current.sourceUrl);
  const now = new Date();

  // 404 is a strong "this listing is gone" signal — treat as unavailable and
  // record the change. Any other non-200 (5xx, anti-bot 403) is transient and
  // shouldn't flip availability.
  if (fetched.status === 404) {
    const changes = diffListing(current, current.priceUsd, "unavailable");
    if (changes.length > 0) {
      await db.insert(listingChanges).values(
        changes.map((c) => ({
          listingId,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          source,
        })),
      );
    }
    await db
      .update(listings)
      .set({
        availability: "unavailable",
        lastCheckedAt: now,
        lastCheckError: null,
      })
      .where(eq(listings.id, listingId));
    return { kind: "ok", changes: changes.length, listingId };
  }

  if (fetched.status !== 200) {
    await db
      .update(listings)
      .set({
        lastCheckedAt: now,
        lastCheckError: `HTTP ${fetched.status} (profiles: ${fetched.triedProfiles.join(", ")})`,
      })
      .where(eq(listings.id, listingId));
    return {
      kind: "fetch_failed",
      status: fetched.status,
      triedProfiles: fetched.triedProfiles,
    };
  }

  const parsed = parser(current.sourceUrl, fetched.html);
  const changes = diffListing(current, parsed.priceUsd, parsed.availability);

  const neighborhood = await resolveNeighborhood({
    parsedNeighborhood: parsed.neighborhood,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  });

  if (changes.length > 0) {
    await db.insert(listingChanges).values(
      changes.map((c) => ({
        listingId,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        source,
      })),
    );
  }

  // Neighborhood is synced silently — not in the audit log per the
  // price+availability-only policy. Parser improvements heal old rows.
  await db
    .update(listings)
    .set({
      priceUsd: parsed.priceUsd,
      availability: parsed.availability,
      neighborhood,
      units: parsed.units,
      lastCheckedAt: now,
      lastCheckError: null,
    })
    .where(eq(listings.id, listingId));

  return { kind: "ok", changes: changes.length, listingId };
}

export async function refreshListingsBatch(
  ids: string[],
  source: RefreshSource,
  concurrency = 4,
): Promise<RefreshOutcome[]> {
  const results: RefreshOutcome[] = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const slice = ids.slice(i, i + concurrency);
    const outcomes = await Promise.all(
      slice.map((id) => refreshListing(id, source)),
    );
    results.push(...outcomes);
  }
  return results;
}
