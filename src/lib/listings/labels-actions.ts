"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { userCanAccessListing } from "./access";
import {
  applyLabelToListing,
  createLabelInScope,
  deleteLabelInScope,
  getLabelInScope,
  removeLabelFromListing,
} from "./labels";

export type LabelActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "saved" };

const LABEL_NAME_MAX = 40;

async function loadAccessibleListing(
  listingId: string,
  authCtx: { userId: string | null; orgId: string | null | undefined },
) {
  const [row] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row) return null;
  if (!userCanAccessListing(row, authCtx)) return null;
  return row;
}

export async function createLabelAction(
  _prev: LabelActionState,
  formData: FormData,
): Promise<LabelActionState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!name) return { kind: "error", message: "Label name is required." };
  if (name.length > LABEL_NAME_MAX) {
    return {
      kind: "error",
      message: `Keep it under ${LABEL_NAME_MAX} characters.`,
    };
  }

  await createLabelInScope({ userId, orgId }, name, color);
  revalidatePath("/");
  return { kind: "saved" };
}

export async function deleteLabelAction(labelId: string): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;
  await deleteLabelInScope({ userId, orgId }, labelId);
  revalidatePath("/");
}

export async function applyLabelAction(
  listingId: string,
  labelId: string,
): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;
  const accessible = await loadAccessibleListing(listingId, { userId, orgId });
  if (!accessible) return;
  // Confirm the label belongs to the same scope
  const label = await getLabelInScope({ userId, orgId }, labelId);
  if (!label) return;
  await applyLabelToListing(listingId, labelId);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
}

export async function removeLabelAction(
  listingId: string,
  labelId: string,
): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;
  const accessible = await loadAccessibleListing(listingId, { userId, orgId });
  if (!accessible) return;
  await removeLabelFromListing(listingId, labelId);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
}
