import { and, asc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPoiDistances, pointsOfInterest } from "@/db/schema";
import {
  fmtTransitDistance,
  fmtTransitDuration,
} from "@/lib/transit-format";

export async function ListingPoiDistances({
  listingId,
}: {
  listingId: string;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await db
    .select({
      poiId: pointsOfInterest.id,
      label: pointsOfInterest.label,
      address: pointsOfInterest.address,
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
    .where(eq(pointsOfInterest.ownerClerkUserId, userId))
    .orderBy(asc(pointsOfInterest.createdAt));

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-3">Transit times</h2>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li
            key={r.poiId}
            className="flex items-baseline justify-between gap-3"
          >
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
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-3">
        Transit times via Google Distance Matrix, computed when the listing
        or POI was added.
      </p>
    </section>
  );
}
