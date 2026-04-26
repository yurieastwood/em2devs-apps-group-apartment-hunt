"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { geocodeAddress } from "./geocode";
import { deletePoiById, insertPoi, updatePoi } from "./points-of-interest";
import {
  ensureDistances,
  getListingIdsInScope,
  invalidateDistancesForPoi,
} from "./places/poi-distances";

export type PoiState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "saved" };

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function addPoiAction(
  _prev: PoiState,
  formData: FormData,
): Promise<PoiState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const label = readField(formData, "label");
  const address = readField(formData, "address");
  if (!label) return { kind: "error", message: "Label is required." };
  if (!address) return { kind: "error", message: "Address is required." };

  const geo = await geocodeAddress(address);
  if (!geo) {
    return {
      kind: "error",
      message: "Couldn't find that address. Try city + state.",
    };
  }

  const inserted = await insertPoi(
    { userId, orgId },
    {
      label,
      address: geo.displayName,
      lat: geo.lat,
      lng: geo.lng,
    },
  );

  const scopeListings = await getListingIdsInScope({ userId, orgId });
  if (scopeListings.length > 0) {
    await ensureDistances(scopeListings, [inserted.id]);
  }

  revalidatePath("/");
  return { kind: "saved" };
}

export async function updatePoiAction(
  poiId: string,
  _prev: PoiState,
  formData: FormData,
): Promise<PoiState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const label = readField(formData, "label");
  const address = readField(formData, "address");
  if (!label) return { kind: "error", message: "Label is required." };
  if (!address) return { kind: "error", message: "Address is required." };

  const geo = await geocodeAddress(address);
  if (!geo) {
    return {
      kind: "error",
      message: "Couldn't find that address. Try city + state.",
    };
  }

  const updated = await updatePoi(
    { userId, orgId },
    poiId,
    {
      label,
      address: geo.displayName,
      lat: geo.lat,
      lng: geo.lng,
    },
  );
  if (!updated) return { kind: "error", message: "Couldn't update." };

  await invalidateDistancesForPoi(poiId);
  const scopeListings = await getListingIdsInScope({ userId, orgId });
  if (scopeListings.length > 0) {
    await ensureDistances(scopeListings, [poiId]);
  }

  revalidatePath("/");
  return { kind: "saved" };
}

export async function deletePoiAction(poiId: string): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId) return;
  await deletePoiById({ userId, orgId }, poiId);
  revalidatePath("/");
}
