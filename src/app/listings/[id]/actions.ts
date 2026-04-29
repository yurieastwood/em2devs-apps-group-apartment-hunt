"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, listings, reactions } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { listingScope, userCanAccessListing } from "@/lib/listings/access";

// Excludes soft-deleted listings so comment / reaction / edit / delete
// actions on items in the trash silently no-op. The trash flow (restore /
// permanent delete) reads the row directly with its own access check.
async function getAccessibleListing(
  listingId: string,
  authCtx: { userId: string | null; orgId: string | null | undefined },
) {
  const [row] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
      deletedAt: listings.deletedAt,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row) return null;
  if (row.deletedAt != null) return null;
  if (!userCanAccessListing(row, authCtx)) return null;
  return row;
}

// Soft-delete: the row stays in the DB so it can be restored or permanently
// purged from the /listings/deleted admin page. R2 photos are kept (no
// cleanup here). Priority is cleared so the active list re-packs cleanly.
export async function deleteListingAction(listingId: string): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;

  const scope = listingScope({ userId, orgId });
  if (!scope) return;

  const target = await getAccessibleListing(listingId, { userId, orgId });
  if (!target) return;

  const isAdmin = await isOrgAdmin();
  const isOwner = target.ownerClerkUserId === userId;
  if (!isAdmin && !isOwner) return;

  // Priority is cleared so a trashed listing doesn't show up in priority
  // sorts; on restore the admin can re-assign it.
  await db
    .update(listings)
    .set({
      deletedAt: new Date(),
      priority: null,
      updatedAt: new Date(),
    })
    .where(and(eq(listings.id, listingId), scope));

  revalidatePath("/");
  revalidatePath("/listings/deleted");
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
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const accessible = await getAccessibleListing(listingId, { userId, orgId });
  if (!accessible) {
    return { kind: "error", message: "You don't have access to this listing." };
  }

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

  if (await isOrgAdmin()) {
    await db.delete(comments).where(eq(comments.id, commentId));
  } else {
    await db
      .delete(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.authorClerkUserId, userId),
        ),
      );
  }

  revalidatePath(`/listings/${listingId}`);
}

export async function toggleReactionAction(
  listingId: string,
  emoji: string,
): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;

  const accessible = await getAccessibleListing(listingId, { userId, orgId });
  if (!accessible) return;

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
