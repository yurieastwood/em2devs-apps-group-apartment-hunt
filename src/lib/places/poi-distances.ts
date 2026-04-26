import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  listingPoiDistances,
  listings,
  pointsOfInterest,
} from "@/db/schema";
import { fetchTransitDistances } from "./distance-matrix";

export type Scope = {
  userId: string;
  orgId: string | null | undefined;
};

const BATCH_ORIGINS = 25; // Distance Matrix limit per request

export async function ensureDistances(
  listingIds: string[],
  poiIds: string[],
): Promise<void> {
  if (listingIds.length === 0 || poiIds.length === 0) return;

  const [existing, listingCoords, poiCoords] = await Promise.all([
    db
      .select({
        listingId: listingPoiDistances.listingId,
        poiId: listingPoiDistances.poiId,
      })
      .from(listingPoiDistances)
      .where(
        and(
          inArray(listingPoiDistances.listingId, listingIds),
          inArray(listingPoiDistances.poiId, poiIds),
        ),
      ),
    db
      .select({
        id: listings.id,
        lat: listings.latitude,
        lng: listings.longitude,
      })
      .from(listings)
      .where(inArray(listings.id, listingIds)),
    db
      .select({
        id: pointsOfInterest.id,
        lat: pointsOfInterest.lat,
        lng: pointsOfInterest.lng,
      })
      .from(pointsOfInterest)
      .where(inArray(pointsOfInterest.id, poiIds)),
  ]);

  const have = new Set(existing.map((r) => `${r.listingId}:${r.poiId}`));

  for (const poi of poiCoords) {
    const missing = listingCoords.filter(
      (l) => l.lat && l.lng && !have.has(`${l.id}:${poi.id}`),
    );
    if (missing.length === 0) continue;

    const destination = {
      lat: parseFloat(poi.lat),
      lng: parseFloat(poi.lng),
    };

    for (let i = 0; i < missing.length; i += BATCH_ORIGINS) {
      const batch = missing.slice(i, i + BATCH_ORIGINS);
      const origins = batch.map((l) => ({
        lat: parseFloat(l.lat as string),
        lng: parseFloat(l.lng as string),
      }));

      const matrix = await fetchTransitDistances(origins, [destination]);

      for (let j = 0; j < batch.length; j++) {
        const listing = batch[j];
        const d = matrix[j]?.[0] ?? {
          durationSeconds: null,
          distanceMeters: null,
        };
        await db
          .insert(listingPoiDistances)
          .values({
            listingId: listing.id,
            poiId: poi.id,
            durationSeconds: d.durationSeconds,
            distanceMeters: d.distanceMeters,
          })
          .onConflictDoUpdate({
            target: [
              listingPoiDistances.listingId,
              listingPoiDistances.poiId,
            ],
            set: {
              durationSeconds: d.durationSeconds,
              distanceMeters: d.distanceMeters,
              computedAt: new Date(),
            },
          });
      }
    }
  }
}

export async function invalidateDistancesForPoi(poiId: string): Promise<void> {
  await db
    .delete(listingPoiDistances)
    .where(eq(listingPoiDistances.poiId, poiId));
}

export async function getListingIdsInScope(scope: Scope): Promise<string[]> {
  const where = scope.orgId
    ? eq(listings.orgId, scope.orgId)
    : and(
        eq(listings.ownerClerkUserId, scope.userId),
        isNull(listings.orgId),
      );
  const rows = await db.select({ id: listings.id }).from(listings).where(where!);
  return rows.map((r) => r.id);
}

export async function getPoiIdsInScope(scope: Scope): Promise<string[]> {
  const where = scope.orgId
    ? eq(pointsOfInterest.orgId, scope.orgId)
    : and(
        eq(pointsOfInterest.ownerClerkUserId, scope.userId),
        isNull(pointsOfInterest.orgId),
      );
  const rows = await db
    .select({ id: pointsOfInterest.id })
    .from(pointsOfInterest)
    .where(where!);
  return rows.map((r) => r.id);
}
