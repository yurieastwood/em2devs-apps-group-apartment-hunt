"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { geocodeAddress } from "./geocode";
import { upsertUserHome } from "./user-settings";

export type SetHomeState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "saved" };

export async function setHomeAction(
  _prev: SetHomeState,
  formData: FormData,
): Promise<SetHomeState> {
  const { userId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const address = String(formData.get("address") ?? "").trim();
  if (!address) {
    return { kind: "error", message: "Type an address first." };
  }

  const result = await geocodeAddress(address);
  if (!result) {
    return {
      kind: "error",
      message:
        "Couldn't find that address. Try including city + state (e.g., '123 Main St, Chicago, IL').",
    };
  }

  await upsertUserHome(userId, result.displayName, result.lat, result.lng);
  revalidatePath("/");
  return { kind: "saved" };
}
