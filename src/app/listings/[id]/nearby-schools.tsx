import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingSchools } from "@/db/schema";

function ratingColorClasses(rating: number): string {
  if (rating <= 3)
    return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40";
  if (rating <= 6)
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40";
  return "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/40";
}

function fmtSchoolMeta(school: {
  schoolType: string | null;
  gradeRange: string | null;
  isAssigned: boolean | null;
  distanceMiles: string | null;
}): string {
  const parts: string[] = [];
  if (school.schoolType) parts.push(school.schoolType);
  if (school.gradeRange) parts.push(school.gradeRange);
  if (school.isAssigned === true) parts.push("Attendance zone");
  else if (school.distanceMiles) {
    const mi = parseFloat(school.distanceMiles);
    if (Number.isFinite(mi)) parts.push(`${mi.toFixed(1)} mi away`);
  }
  return parts.join(" · ");
}

export async function NearbySchools({ listingId }: { listingId: string }) {
  const schools = await db
    .select()
    .from(listingSchools)
    .where(eq(listingSchools.listingId, listingId))
    .orderBy(asc(listingSchools.sortOrder));

  if (schools.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-3">Nearby schools</h2>
      <ul className="space-y-3">
        {schools.map((s) => (
          <li
            key={s.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {s.greatSchoolsUrl ? (
                  <a
                    href={s.greatSchoolsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtSchoolMeta(s)}
              </p>
            </div>
            {s.rating != null ? (
              <span
                className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium tabular-nums ${ratingColorClasses(s.rating)}`}
                title="GreatSchools rating"
              >
                {s.rating}/10
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-3">
        Ratings from GreatSchools, sourced from the listing site.
      </p>
    </section>
  );
}
