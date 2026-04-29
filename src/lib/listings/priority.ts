import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import {
  listingScope,
  userCanAccessListing,
  type AuthCtx,
} from "./access";

export type SetPriorityResult = { ok: true } | { ok: false; reason: string };

// Free-form priority with collision shift: any positive integer is valid;
// null means unprioritized. Setting priority P on a listing shifts every
// other listing in the same scope whose priority is >= P up by 1, then
// writes P. So if A=3 and you set L=3, A becomes 4 (and any further
// collisions cascade automatically since the shift is a single bulk
// update). Gaps are allowed; you can pick any number.
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

  // 1) Vacate this listing's slot so the bulk shift below doesn't double-
  //    count it.
  if (target.priority !== null) {
    await db
      .update(listings)
      .set({ priority: null })
      .where(eq(listings.id, listingId));
  }

  // 2) Shift every other listing in scope with priority >= newPriority up
  //    by 1 — resolves the collision and any chained collisions in one go.
  // 3) Write the new priority.
  if (newPriority !== null) {
    await db
      .update(listings)
      .set({ priority: sql`${listings.priority} + 1` })
      .where(and(where, gte(listings.priority, newPriority)));
    await db
      .update(listings)
      .set({ priority: newPriority })
      .where(eq(listings.id, listingId));
  }

  return { ok: true };
}
