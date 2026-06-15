import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { comments } from "@/db/schema";

// Batch comment counts keyed by listing id. Listings with no comments are
// simply absent from the map (callers default to 0).
export async function getCommentCounts(
  listingIds: string[],
): Promise<Map<string, number>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db
    .select({
      listingId: comments.listingId,
      count: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(inArray(comments.listingId, listingIds))
    .groupBy(comments.listingId);
  return new Map(rows.map((r) => [r.listingId, r.count]));
}
