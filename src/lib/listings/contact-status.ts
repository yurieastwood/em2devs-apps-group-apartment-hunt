import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { userCanAccessListing, type AuthCtx } from "./access";

// User-managed pipeline state for a listing, independent of scraped
// availability. null means no contact has happened yet.
export type ContactStatus = "contacted" | "visited" | "applied" | "discarded";

export const CONTACT_STATUSES: ReadonlyArray<{
  value: ContactStatus;
  label: string;
}> = [
  { value: "contacted", label: "Contacted" },
  { value: "visited", label: "Visited" },
  { value: "applied", label: "Applied" },
  { value: "discarded", label: "Discarded" },
];

const LABEL_BY_VALUE: Record<ContactStatus, string> = Object.fromEntries(
  CONTACT_STATUSES.map((s) => [s.value, s.label]),
) as Record<ContactStatus, string>;

export function isContactStatus(v: unknown): v is ContactStatus {
  return (
    typeof v === "string" &&
    CONTACT_STATUSES.some((s) => s.value === v)
  );
}

export function contactStatusLabel(v: string | null): string | null {
  return v != null && isContactStatus(v) ? LABEL_BY_VALUE[v] : null;
}

export type SetContactStatusResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function setContactStatus(
  scope: AuthCtx,
  listingId: string,
  status: ContactStatus | null,
): Promise<SetContactStatusResult> {
  if (status !== null && !isContactStatus(status)) {
    return { ok: false, reason: "Invalid status" };
  }

  const [target] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!target) return { ok: false, reason: "Listing not found" };
  if (!userCanAccessListing(target, scope)) {
    return { ok: false, reason: "No access" };
  }

  await db
    .update(listings)
    .set({ contactStatus: status })
    .where(eq(listings.id, listingId));

  return { ok: true };
}
