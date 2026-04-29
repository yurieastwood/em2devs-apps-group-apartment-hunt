import { and, asc, eq, isNull } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPoiDistances, pointsOfInterest } from "@/db/schema";
import {
  fmtTransitDistance,
  fmtTransitDuration,
  googleMapsTransitDirectionsUrl,
} from "@/lib/transit-format";

export async function ListingPoiDistances({
  listingId,
  listingLat,
  listingLng,
}: {
  listingId: string;
  listingLat: number | null;
  listingLng: number | null;
}) {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const poiScope = orgId
    ? eq(pointsOfInterest.orgId, orgId)
    : and(
        eq(pointsOfInterest.ownerClerkUserId, userId),
        isNull(pointsOfInterest.orgId),
      );

  const rows = await db
    .select({
      poiId: pointsOfInterest.id,
      label: pointsOfInterest.label,
      address: pointsOfInterest.address,
      lat: pointsOfInterest.lat,
      lng: pointsOfInterest.lng,
      durationSeconds: listingPoiDistances.durationSeconds,
      distanceMeters: listingPoiDistances.distanceMeters,
    })
    .from(pointsOfInterest)
    .leftJoin(
      listingPoiDistances,
      and(
        eq(listingPoiDistances.poiId, pointsOfInterest.id),
        eq(listingPoiDistances.listingId, listingId),
      ),
    )
    .where(poiScope!)
    .orderBy(asc(pointsOfInterest.createdAt));

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-3">Transit times</h2>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => {
          const url = googleMapsTransitDirectionsUrl(
            { lat: listingLat, lng: listingLng },
            { lat: parseFloat(r.lat), lng: parseFloat(r.lng) },
          );
          const body = (
            <>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.address}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-medium tabular-nums">
                  {fmtTransitDuration(r.durationSeconds) ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {fmtTransitDistance(r.distanceMeters) ?? "no data"}
                </p>
              </div>
            </>
          );
          return (
            <li key={r.poiId}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline justify-between gap-3 rounded p-1 -m-1 hover:bg-muted/40"
                  title="Open transit directions in Google Maps"
                >
                  {body}
                </a>
              ) : (
                <div className="flex items-baseline justify-between gap-3 p-1">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground mt-3">
        Transit times via Google Distance Matrix, computed when the listing
        or POI was added.
      </p>
    </section>
  );
}
