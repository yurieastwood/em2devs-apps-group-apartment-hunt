"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isOrgAdmin } from "@/lib/auth/roles";
import { computeSafetyScore } from "./safety";
import { geocodeAddress } from "./geocode";
import { setHome } from "./home-settings";

export type SetHomeState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "saved" };

export async function setHomeAction(
  _prev: SetHomeState,
  formData: FormData,
): Promise<SetHomeState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };
  if (!(await isOrgAdmin())) {
    return { kind: "error", message: "Admins only — ask an admin to set this." };
  }

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

  // Compute the home's raw safety so listings can be scored relative to it.
  // Outside-Chicago homes return null and we degrade to library-percentile
  // on the home page.
  const safety = await computeSafetyScore(result.lat, result.lng);
  const homeSafety = safety
    ? { raw: safety.breakdown.raw, breakdown: safety.breakdown }
    : null;

  await setHome(
    { userId, orgId },
    result.displayName,
    result.lat,
    result.lng,
    homeSafety,
  );
  revalidatePath("/");
  return { kind: "saved" };
}
