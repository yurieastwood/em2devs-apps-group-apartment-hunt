"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { setListingPriority, type SetPriorityResult } from "./priority";

export async function setListingPriorityAction(
  listingId: string,
  newPriority: number | null,
): Promise<SetPriorityResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const result = await setListingPriority(
    { userId, orgId },
    listingId,
    newPriority,
  );

  revalidatePath("/");
  revalidatePath("/listings/[id]", "page");

  return result;
}
