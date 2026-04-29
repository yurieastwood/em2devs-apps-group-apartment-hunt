import { and, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { listings } from "@/db/schema";

export type AuthCtx = {
  userId: string | null;
  orgId: string | null | undefined;
};

// Active scope: family-visible AND not soft-deleted. Every list / filter /
// action that operates on the visible listings uses this.
// - In an org: see listings where listings.org_id = active org id.
// - Personal mode (no active org): see listings the user owns that have no
//   org_id (legacy / pre-orgs data, or new ones added before joining an org).
export function listingScope(auth: AuthCtx): SQL | undefined {
  if (!auth.userId) return undefined;
  const notDeleted = isNull(listings.deletedAt);
  if (auth.orgId) return and(eq(listings.orgId, auth.orgId), notDeleted);
  return and(
    eq(listings.ownerClerkUserId, auth.userId),
    isNull(listings.orgId),
    notDeleted,
  );
}

// Trash scope: family-visible AND soft-deleted. Used by the
// /listings/deleted admin-only page.
export function deletedListingScope(auth: AuthCtx): SQL | undefined {
  if (!auth.userId) return undefined;
  const isDeleted = isNotNull(listings.deletedAt);
  if (auth.orgId) return and(eq(listings.orgId, auth.orgId), isDeleted);
  return and(
    eq(listings.ownerClerkUserId, auth.userId),
    isNull(listings.orgId),
    isDeleted,
  );
}

// Pure ownership/org-membership check, indifferent to soft-delete state. The
// caller decides what to do when the listing is in the trash (members get
// notFound; admins get the restore banner).
export function userCanAccessListing(
  listing: { orgId: string | null; ownerClerkUserId: string },
  auth: AuthCtx,
): boolean {
  if (!auth.userId) return false;
  if (auth.orgId) return listing.orgId === auth.orgId;
  return listing.orgId === null && listing.ownerClerkUserId === auth.userId;
}
