import { and, eq, isNull, type SQL } from "drizzle-orm";
import { listings } from "@/db/schema";

export type AuthCtx = {
  userId: string | null;
  orgId: string | null | undefined;
};

// Active scope:
// - In an org: see listings where listings.org_id = active org id.
// - Personal mode (no active org): see listings the user owns that have no
//   org_id (legacy / pre-orgs data, or new ones added before joining an org).
// Strict separation keeps org membership meaningful — joining an org doesn't
// pull in your personal stash, and vice versa.
export function listingScope(auth: AuthCtx): SQL | undefined {
  if (!auth.userId) return undefined;
  if (auth.orgId) return eq(listings.orgId, auth.orgId);
  return and(
    eq(listings.ownerClerkUserId, auth.userId),
    isNull(listings.orgId),
  );
}

export function userCanAccessListing(
  listing: { orgId: string | null; ownerClerkUserId: string },
  auth: AuthCtx,
): boolean {
  if (!auth.userId) return false;
  if (auth.orgId) return listing.orgId === auth.orgId;
  return listing.orgId === null && listing.ownerClerkUserId === auth.userId;
}
