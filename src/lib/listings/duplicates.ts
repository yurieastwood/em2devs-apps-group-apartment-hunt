import { and, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { listingScope, type AuthCtx } from "./access";

// Two listings within this distance are treated as "possibly the same place".
// The same building geocodes to ~the same point across sources (Zillow vs a
// manual GPS pin), but different geocoders drift, so allow some slack.
const DUP_DISTANCE_METERS = 60;

export type DuplicateMatch = {
  id: string;
  label: string;
  reason: "location" | "address";
};

const ABBREV: Record<string, string> = {
  street: "st",
  avenue: "ave",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  court: "ct",
  lane: "ln",
  place: "pl",
  terrace: "ter",
  apartment: "apt",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

// A normalized "house number + street" key from the first address segment,
// with unit/apt fragments stripped. This is the reliable cross-source signal:
// "2341 W Adams Street, Unit 2E, Chicago, IL 60612", "2341 W Adams St #2E",
// and "2341 W Adams St, Chicago, IL" all collapse to "2341 w adams st".
// (Coordinates can drift hundreds of meters between sources, so they're only a
// secondary check.) Units in the same building share a key — acceptable for a
// soft "you also have a listing here" hint.
function streetKey(addr: string | null): string | null {
  if (!addr) return null;
  let s = (addr.split(",")[0] ?? "").toLowerCase();
  s = s.replace(/#\s*\w+/g, " ");
  s = s.replace(/\b(apt|unit|ste|suite|fl|floor|rm|no)\b\.?\s*\w*/g, " ");
  s = s
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBREV[w] ?? w)
    .join(" ");
  // Require a digit so we don't match on a bare street name with no number.
  return s.length > 0 && /\d/.test(s) ? s : null;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type DupCandidate = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
};

// In-memory variant for a list already loaded in scope (e.g. the home page):
// returns the set of ids that share a street key or sit within the distance
// threshold of at least one other item. O(n²), fine for a family-sized list.
export function flagDuplicateIds(items: DupCandidate[]): Set<string> {
  const keyed = items.map((i) => ({ ...i, key: streetKey(i.address) }));
  const dup = new Set<string>();
  for (let a = 0; a < keyed.length; a += 1) {
    for (let b = a + 1; b < keyed.length; b += 1) {
      const A = keyed[a];
      const B = keyed[b];
      let match = false;
      if (A.key && B.key && A.key === B.key) {
        match = true;
      } else if (
        A.latitude != null &&
        A.longitude != null &&
        B.latitude != null &&
        B.longitude != null
      ) {
        match =
          haversineMeters(A.latitude, A.longitude, B.latitude, B.longitude) <=
          DUP_DISTANCE_METERS;
      }
      if (match) {
        dup.add(A.id);
        dup.add(B.id);
      }
    }
  }
  return dup;
}

// Soft "possible duplicate" detection within the caller's scope: other
// (non-deleted) listings at nearly the same coordinates, or with the same
// normalized address. Never blocks creation — purely a hint.
export async function findPossibleDuplicates(
  scope: AuthCtx,
  target: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  },
): Promise<DuplicateMatch[]> {
  const where = listingScope(scope);
  if (!where) return [];

  const rows = await db
    .select({
      id: listings.id,
      address: listings.address,
      title: listings.title,
      latitude: listings.latitude,
      longitude: listings.longitude,
    })
    .from(listings)
    .where(and(where, ne(listings.id, target.id)));

  const targetKey = streetKey(target.address);
  const matches: DuplicateMatch[] = [];

  for (const r of rows) {
    if (targetKey && streetKey(r.address) === targetKey) {
      matches.push({
        id: r.id,
        label: r.address ?? r.title ?? "Listing",
        reason: "address",
      });
      continue;
    }
    if (
      target.latitude != null &&
      target.longitude != null &&
      r.latitude != null &&
      r.longitude != null
    ) {
      const d = haversineMeters(
        target.latitude,
        target.longitude,
        parseFloat(r.latitude),
        parseFloat(r.longitude),
      );
      if (Number.isFinite(d) && d <= DUP_DISTANCE_METERS) {
        matches.push({
          id: r.id,
          label: r.address ?? r.title ?? "Listing",
          reason: "location",
        });
      }
    }
  }

  return matches;
}
