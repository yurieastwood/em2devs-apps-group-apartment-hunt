import { and, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";

export type HealthIssue = {
  listingId: string;
  label: string;
  error: string;
};

// Listings whose most recent refresh in the window left a lastCheckError —
// HTTP/anti-bot failures and "empty parse" (stale-parser) flags both land
// here. Excludes trashed listings.
export async function buildScrapeHealth(
  windowHours: number = 24,
): Promise<HealthIssue[]> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: listings.id,
      address: listings.address,
      title: listings.title,
      error: listings.lastCheckError,
    })
    .from(listings)
    .where(
      and(
        isNotNull(listings.lastCheckError),
        gte(listings.lastCheckedAt, since),
        isNull(listings.deletedAt),
      ),
    );

  return rows.map((r) => ({
    listingId: r.id,
    label: r.address ?? r.title ?? "Listing",
    error: r.error ?? "unknown error",
  }));
}
