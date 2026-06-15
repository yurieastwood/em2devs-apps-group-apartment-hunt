"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  setContactStatus,
  type ContactStatus,
  type SetContactStatusResult,
} from "./contact-status";

export async function setContactStatusAction(
  listingId: string,
  status: ContactStatus | null,
): Promise<SetContactStatusResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const result = await setContactStatus({ userId, orgId }, listingId, status);

  revalidatePath("/");
  revalidatePath("/listings/[id]", "page");

  return result;
}
