import { and, eq, gt, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import {
  listingScope,
  userCanAccessListing,
  type AuthCtx,
} from "./access";

export type SetPriorityResult = { ok: true } | { ok: false; reason: string };

// Contiguous priority within scope: existing prioritized listings have
// priorities 1..N. Setting one to a slot in [1..N+1] (when adding) or
// [1..N] (when moving) shifts the others to keep the sequence packed.
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

  const oldPriority = target.priority;
  if (oldPriority === newPriority) return { ok: true };

  const where = listingScope(scope);
  if (!where) return { ok: false, reason: "No active scope" };

  // Validate range
  if (newPriority !== null) {
    const [{ count: prioritizedCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(where, isNotNull(listings.priority)));
    const upperBound =
      oldPriority === null ? prioritizedCount + 1 : prioritizedCount;
    if (newPriority < 1 || newPriority > upperBound) {
      return {
        ok: false,
        reason: `Priority must be between 1 and ${upperBound}`,
      };
    }
  }

  // Cases: null→P, P→null, P→P
  if (oldPriority === null && newPriority !== null) {
    await db
      .update(listings)
      .set({ priority: sql`${listings.priority} + 1` })
      .where(and(where, gte(listings.priority, newPriority)));
    await db
      .update(listings)
      .set({ priority: newPriority })
      .where(eq(listings.id, listingId));
  } else if (oldPriority !== null && newPriority === null) {
    await db
      .update(listings)
      .set({ priority: sql`${listings.priority} - 1` })
      .where(and(where, gt(listings.priority, oldPriority)));
    await db
      .update(listings)
      .set({ priority: null })
      .where(eq(listings.id, listingId));
  } else if (oldPriority !== null && newPriority !== null) {
    if (newPriority < oldPriority) {
      await db
        .update(listings)
        .set({ priority: sql`${listings.priority} + 1` })
        .where(
          and(
            where,
            gte(listings.priority, newPriority),
            lt(listings.priority, oldPriority),
          ),
        );
    } else {
      await db
        .update(listings)
        .set({ priority: sql`${listings.priority} - 1` })
        .where(
          and(
            where,
            gt(listings.priority, oldPriority),
            lte(listings.priority, newPriority),
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

export async function shiftPrioritiesAfterDelete(
  scope: AuthCtx,
  removedPriority: number | null,
): Promise<void> {
  if (removedPriority === null) return;
  const where = listingScope(scope);
  if (!where) return;
  await db
    .update(listings)
    .set({ priority: sql`${listings.priority} - 1` })
    .where(and(where, gt(listings.priority, removedPriority)));
}
