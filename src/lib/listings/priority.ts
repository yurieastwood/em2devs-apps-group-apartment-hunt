import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import {
  listingScope,
  userCanAccessListing,
  type AuthCtx,
} from "./access";

export type SetPriorityResult = { ok: true } | { ok: false; reason: string };

// Free-form priority with minimal-shift collision handling.
// - Any positive integer is valid; null means unprioritized.
// - Setting priority P on a listing shifts only the contiguous run of
//   already-taken priorities starting at P up by 1, stopping at the first
//   gap. Listings beyond the gap stay put.
//
// Example: priorities {1, 3, 4, 7, 9}; setting a new listing to 1 →
//   1 is taken, 2 is a gap → shift only the listing at 1, becomes
//   {1(new), 2, 3, 4, 7, 9}.
//
// Example: priorities {1, 2, 3, 5}; setting a new listing to 1 →
//   1, 2, 3 are a contiguous run, 4 is the first gap → shift 1→2, 2→3,
//   3→4, and the new listing takes 1.
export async function setListingPriority(
  scope: AuthCtx,
  listingId: string,
  newPriority: number | null,
): Promise<SetPriorityResult> {
  const [target] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
      priority: listings.priority,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!target) return { ok: false, reason: "Listing not found" };
  if (!userCanAccessListing(target, scope)) {
    return { ok: false, reason: "No access" };
  }
  if (target.priority === newPriority) return { ok: true };

  if (newPriority !== null) {
    if (!Number.isInteger(newPriority) || newPriority < 1) {
      return { ok: false, reason: "Priority must be a positive integer" };
    }
  }

  const where = listingScope(scope);
  if (!where) return { ok: false, reason: "No active scope" };

  // Vacate this listing's slot so the contiguous-run computation below
  // doesn't see its old priority.
  if (target.priority !== null) {
    await db
      .update(listings)
      .set({ priority: null })
      .where(eq(listings.id, listingId));
  }

  if (newPriority !== null) {
    // Find the first gap at or after newPriority. Only listings whose
    // priorities fall in [newPriority, firstGap - 1] need to shift.
    const rows = await db
      .select({ priority: listings.priority })
      .from(listings)
      .where(and(where, isNotNull(listings.priority)));
    const taken = new Set<number>();
    for (const r of rows) if (r.priority != null) taken.add(r.priority);

    let firstGap = newPriority;
    while (taken.has(firstGap)) firstGap += 1;

    if (firstGap > newPriority) {
      await db
        .update(listings)
        .set({ priority: sql`${listings.priority} + 1` })
        .where(
          and(
            where,
            gte(listings.priority, newPriority),
            lte(listings.priority, firstGap - 1),
          ),
        );
    }

    await db
      .update(listings)
      .set({ priority: newPriority })
      .where(eq(listings.id, listingId));
  }

  return { ok: true };
}
