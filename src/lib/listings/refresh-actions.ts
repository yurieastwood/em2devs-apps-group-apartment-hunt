"use server";

import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { listingScope, userCanAccessListing } from "./access";
import {
  refreshListing,
  refreshListingsBatch,
  type RefreshOutcome,
} from "./refresh";

export type RefreshActionResult =
  | { ok: true; outcome: RefreshOutcome }
  | { ok: false; reason: string };

export async function refreshListingAction(
  listingId: string,
): Promise<RefreshActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const [target] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!target || !userCanAccessListing(target, { userId, orgId })) {
    return { ok: false, reason: "Listing not found" };
  }

  const outcome = await refreshListing(listingId, "manual");
  revalidatePath("/");
  revalidatePath("/listings/[id]", "page");
  return { ok: true, outcome };
}

export type RefreshAllActionResult =
  | { ok: true; total: number; changed: number; failed: number }
  | { ok: false; reason: string };

export async function refreshAllListingsAction(): Promise<RefreshAllActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };
  if (!(await isOrgAdmin())) {
    return { ok: false, reason: "Admins only" };
  }

  const scope = listingScope({ userId, orgId });
  if (!scope) return { ok: false, reason: "No active scope" };

  const rows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(scope);

  const outcomes = await refreshListingsBatch(
    rows.map((r) => r.id),
    "manual",
  );

  let changed = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.kind === "ok") {
      if (o.changes > 0) changed += 1;
    } else if (o.kind === "fetch_failed") {
      failed += 1;
    }
  }

  revalidatePath("/");
  return { ok: true, total: rows.length, changed, failed };
}
