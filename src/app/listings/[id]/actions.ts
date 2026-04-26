"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  comments,
  listingPhotos,
  listings,
  reactions,
} from "@/db/schema";
import { deleteObjects } from "@/lib/storage/r2";

// Returns void after revalidating /. Caller decides whether to navigate
// (the detail page will router.push("/") because the page no longer points
// at a real listing; the home-page caller stays put — the listing just
// disappears from the now-revalidated list).
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

  revalidatePath("/");
}

export type CommentState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "posted" };

export async function addCommentAction(
  listingId: string,
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const { userId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { kind: "error", message: "Type something first." };
  if (body.length > 5000) {
    return { kind: "error", message: "Comment too long (5000 character max)." };
  }

  await db.insert(comments).values({
    listingId,
    authorClerkUserId: userId,
    body,
  });

  revalidatePath(`/listings/${listingId}`);
  return { kind: "posted" };
}

export async function deleteCommentAction(
  commentId: string,
  listingId: string,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  await db
    .delete(comments)
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.authorClerkUserId, userId),
      ),
    );

  revalidatePath(`/listings/${listingId}`);
}

export async function toggleReactionAction(
  listingId: string,
  emoji: string,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const existing = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.listingId, listingId),
        eq(reactions.authorClerkUserId, userId),
        eq(reactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(reactions).where(eq(reactions.id, existing[0].id));
  } else {
    await db.insert(reactions).values({
      listingId,
      authorClerkUserId: userId,
      emoji,
    });
  }

  revalidatePath(`/listings/${listingId}`);
}
