import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { ensureDistances, getPoiIdsInScope } from "../places/poi-distances";
import { computeSafetyScore } from "../safety";
import { geocodeAddress } from "../geocode";
import { resolveLocale } from "./resolve-locale";
import { MANUAL_SOURCE_HOST, MANUAL_SOURCE_SCHEME } from "./manual-source";
import {
  storeOptimizedImage,
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
} from "./photo-store";

// Sentinel host/scheme for manual listings live in ./manual-source (kept
// sharp-free so render routes can import the helpers). Re-export for callers
// that already import them from here.
export {
  MANUAL_SOURCE_HOST,
  MANUAL_SOURCE_SCHEME,
  isManualListing,
} from "./manual-source";

const MAX_PHOTOS = 24;

export type ManualListingInput = {
  title: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  priceUsd: number | null;
  description: string | null;
  // Precise coordinates from the device GPS, when the user used "current
  // location". When present, these are used directly instead of geocoding the
  // typed address.
  latitude: number | null;
  longitude: number | null;
  photos: File[];
};

export type CreateManualResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function storeUploadedPhotos(
  listingId: string,
  files: File[],
): Promise<(typeof listingPhotos.$inferInsert)[]> {
  const rows: (typeof listingPhotos.$inferInsert)[] = [];
  let sortOrder = 0;
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (!file || file.size === 0 || file.size > MAX_PHOTO_BYTES) continue;
    const contentType = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) continue;

    const input = Buffer.from(await file.arrayBuffer());
    const row = await storeOptimizedImage(
      listingId,
      sortOrder,
      input,
      `upload://${file.name || `photo-${sortOrder}`}`,
    );
    if (row) {
      rows.push(row);
      sortOrder += 1;
    }
  }
  return rows;
}

export async function createListingManually(
  input: ManualListingInput,
  ownerClerkUserId: string,
  orgId: string | null,
): Promise<CreateManualResult> {
  const address = input.address.trim();
  if (!address) return { ok: false, error: "Address is required." };

  const fullAddress =
    [address, input.city, input.state, input.zipCode]
      .map((p) => p?.trim())
      .filter((p): p is string => !!p)
      .join(", ") || address;

  // Prefer precise device-GPS coordinates when supplied; otherwise geocode the
  // typed address for map placement, neighborhood/district, and safety score.
  // A failed geocode is non-fatal — the listing is still created without
  // coordinates (and editable later to fix the address).
  let latitude = input.latitude;
  let longitude = input.longitude;
  if (latitude == null || longitude == null) {
    const geo = await geocodeAddress(fullAddress);
    latitude = geo?.lat ?? null;
    longitude = geo?.lng ?? null;
  }

  const { neighborhood, district } = await resolveLocale({
    parsedNeighborhood: null,
    parsedDistrict: null,
    latitude,
    longitude,
  });
  const safety = await computeSafetyScore(latitude, longitude);

  const [inserted] = await db
    .insert(listings)
    .values({
      ownerClerkUserId,
      orgId,
      sourceUrl: `${MANUAL_SOURCE_SCHEME}//${randomUUID()}`,
      sourceHost: MANUAL_SOURCE_HOST,
      sourceListingId: null,
      title: input.title?.trim() || address,
      address: fullAddress,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      latitude: latitude?.toString() ?? null,
      longitude: longitude?.toString() ?? null,
      bedrooms: input.bedrooms?.toString() ?? null,
      bathrooms: input.bathrooms?.toString() ?? null,
      squareFeet: input.squareFeet,
      priceUsd: input.priceUsd,
      description: input.description,
      neighborhood,
      district,
      availability: "unknown",
      safetyScore: safety?.score ?? null,
      safetyBreakdown: safety?.breakdown ?? null,
      lastCheckedAt: new Date(),
      raw: { kind: "manual" },
    })
    .returning({ id: listings.id });

  const photoRows = await storeUploadedPhotos(inserted.id, input.photos);
  if (photoRows.length > 0) {
    await db.insert(listingPhotos).values(photoRows);
  }

  const scopePoiIds = await getPoiIdsInScope({ userId: ownerClerkUserId, orgId });
  if (scopePoiIds.length > 0 && latitude != null && longitude != null) {
    await ensureDistances([inserted.id], scopePoiIds);
  }

  return { ok: true, id: inserted.id };
}
