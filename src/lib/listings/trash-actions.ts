"use server";

import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { deleteObjects } from "@/lib/storage/r2";
import { deletedListingScope } from "./access";

export type TrashActionResult =
  | { ok: true }
  | { ok: false; reason: string };

// Bring a soft-deleted listing back to the active list. Priority stays null —
// the user can re-prioritize after restoring. Admin-only.
export async function restoreListingAction(
  listingId: string,
): Promise<TrashActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };
  if (!(await isOrgAdmin())) return { ok: false, reason: "Admins only" };

  const scope = deletedListingScope({ userId, orgId });
  if (!scope) return { ok: false, reason: "No active scope" };

  const result = await db
    .update(listings)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(listings.id, listingId), scope))
    .returning({ id: listings.id });

  if (result.length === 0) {
    return { ok: false, reason: "Listing not found in trash" };
  }

  revalidatePath("/");
  revalidatePath("/listings/deleted");
  revalidatePath("/listings/[id]", "page");
  return { ok: true };
}

// Permanently delete a soft-deleted listing — drops the DB row (cascades
// listing_photos, listing_changes, etc.) and removes R2 photo objects. No
// undo. Admin-only and only operates on listings already in the trash.
export async function permanentlyDeleteListingAction(
  listingId: string,
): Promise<TrashActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };
  if (!(await isOrgAdmin())) return { ok: false, reason: "Admins only" };

  const scope = deletedListingScope({ userId, orgId });
  if (!scope) return { ok: false, reason: "No active scope" };

  const photos = await db
    .select({ r2Key: listingPhotos.r2Key })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId));

  const result = await db
    .delete(listings)
    .where(and(eq(listings.id, listingId), scope))
    .returning({ id: listings.id });

  if (result.length === 0) {
    return { ok: false, reason: "Listing not found in trash" };
  }

  if (photos.length > 0) {
    try {
      await deleteObjects(photos.map((p) => p.r2Key));
    } catch (err) {
      console.error("r2 cleanup failed for listing", listingId, err);
    }
  }

  revalidatePath("/listings/deleted");
  return { ok: true };
}
