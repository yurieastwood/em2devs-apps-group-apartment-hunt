import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingSchools } from "@/db/schema";
import { SchoolsBrowser } from "./schools-browser";

export async function NearbySchools({ listingId }: { listingId: string }) {
  const rows = await db
    .select()
    .from(listingSchools)
    .where(eq(listingSchools.listingId, listingId))
    .orderBy(asc(listingSchools.sortOrder));

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-3">Nearby schools</h2>
      <SchoolsBrowser
        schools={rows.map((r) => ({
          id: r.id,
          name: r.name,
          schoolType: r.schoolType,
          gradeRange: r.gradeRange,
          rating: r.rating,
          distanceMiles: r.distanceMiles,
          isAssigned: r.isAssigned,
          greatSchoolsUrl: r.greatSchoolsUrl,
        }))}
      />
      <p className="text-xs text-muted-foreground mt-4">
        Ratings from GreatSchools, sourced from the listing site.
      </p>
    </section>
  );
}
