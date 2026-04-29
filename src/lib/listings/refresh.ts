import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges, listings, type Listing } from "@/db/schema";
import { fetchListing } from "../extract/fetch-listing";
import { parseApartmentList } from "../extract/parsers/apartmentlist";
import { parseApartments } from "../extract/parsers/apartments";
import { parseZillow } from "../extract/parsers/zillow";
import type {
  Availability,
  ParsedListing,
  ParsedUnit,
} from "../extract/types";
import { resolveNeighborhood } from "./resolve-neighborhood";

type Headline = {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  price: number | null;
  locked: boolean;
};

// For multi-unit listings, the displayed values on the home card depend on
// whether the user has locked a specific floorplan. If locked, find a unit
// matching the locked (beds, baths) and pick the cheapest matching unit;
// price and sqft refresh while the floorplan choice persists. If the locked
// floorplan no longer exists in the new units array, fall back to the
// auto-pick the parser already computed and clear the lock.
function computeHeadline(current: Listing, parsed: ParsedListing): Headline {
  const units: ParsedUnit[] | null = parsed.units;
  if (units && units.length > 0 && current.headlineLocked) {
    const targetBeds =
      current.bedrooms != null ? parseFloat(current.bedrooms) : null;
    const targetBaths =
      current.bathrooms != null ? parseFloat(current.bathrooms) : null;
    if (targetBeds != null && targetBaths != null) {
      const matched = units.filter(
        (u) => u.beds === targetBeds && u.baths === targetBaths,
      );
      if (matched.length > 0) {
        const cheapest = [...matched].sort(
          (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
        )[0];
        return {
          beds: cheapest.beds,
          baths: cheapest.baths,
          sqft: cheapest.sqft,
          price: cheapest.price,
          locked: true,
        };
      }
    }
  }
  // Auto-pick or single-home — the parser already populated single-value
  // fields with the right values; lock clears.
  return {
    beds: parsed.bedrooms,
    baths: parsed.bathrooms,
    sqft: parsed.squareFeet,
    price: parsed.priceUsd,
    locked: false,
  };
}

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
  const headline = computeHeadline(current, parsed);
  const changes = diffListing(current, headline.price, parsed.availability);

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

  // Neighborhood + units + headline columns are synced silently — not in the
  // audit log per the price+availability-only policy. Parser improvements
  // heal old rows. Multi-unit listings refresh beds/baths/sqft from the
  // headline; single-home listings keep their stable values via the same
  // path (computeHeadline returns parsed.* for them).
  const isMultiUnit = parsed.units != null && parsed.units.length > 0;
  await db
    .update(listings)
    .set({
      bedrooms: isMultiUnit ? headline.beds?.toString() ?? null : current.bedrooms,
      bathrooms: isMultiUnit
        ? headline.baths?.toString() ?? null
        : current.bathrooms,
      squareFeet: isMultiUnit ? headline.sqft : current.squareFeet,
      priceUsd: headline.price,
      headlineLocked: headline.locked,
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
