"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { deleteObjects } from "@/lib/storage/r2";

export async function deleteListingAction(listingId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const photos = await db
    .select({ r2Key: listingPhotos.r2Key })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId));

  const result = await db
    .delete(listings)
    .where(
      and(
        eq(listings.id, listingId),
        eq(listings.ownerClerkUserId, userId),
      ),
    )
    .returning({ id: listings.id });

  if (result.length === 0) {
    return;
  }

  if (photos.length > 0) {
    try {
      await deleteObjects(photos.map((p) => p.r2Key));
    } catch (err) {
      console.error("r2 cleanup failed for listing", listingId, err);
    }
  }

  redirect("/");
}
