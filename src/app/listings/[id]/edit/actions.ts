"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { geocodeAddress } from "@/lib/geocode";
import { listingScope } from "@/lib/listings/access";
import {
  ensureDistances,
  getPoiIdsInScope,
} from "@/lib/places/poi-distances";

export type EditState = { kind: "idle" } | { kind: "error"; message: string };

function readString(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumericString(formData: FormData, name: string): string | null {
  const s = readString(formData, name);
  if (s === null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return s;
}

function readInt(formData: FormData, name: string): number | null {
  const s = readString(formData, name);
  if (s === null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function updateListingAction(
  listingId: string,
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };
  if (!(await isOrgAdmin())) {
    return { kind: "error", message: "Admins only — ask an admin to edit this." };
  }

  const scope = listingScope({ userId, orgId });
  if (!scope) {
    return { kind: "error", message: "Couldn't update — no access." };
  }

  // Read the current row first so we can decide whether to re-geocode.
  // Geocoding fires when the address text changed OR when the listing has
  // no coordinates yet (heals listings that imported with empty coords).
  const [current] = await db
    .select({
      address: listings.address,
      latitude: listings.latitude,
      longitude: listings.longitude,
    })
    .from(listings)
    .where(and(eq(listings.id, listingId), scope))
    .limit(1);
  if (!current) {
    return { kind: "error", message: "Couldn't update — not in your scope." };
  }

  const newAddress = readString(formData, "address");
  const newCity = readString(formData, "city");
  const newState = readString(formData, "state");
  const newZip = readString(formData, "zipCode");

  let nextLat: string | null = current.latitude;
  let nextLng: string | null = current.longitude;
  let coordsJustSet = false;

  const fullAddress =
    [newAddress, newCity, newState, newZip].filter(Boolean).join(", ") ||
    null;
  const addressChanged = newAddress !== current.address;
  const coordsMissing = current.latitude == null || current.longitude == null;

  if (fullAddress && (addressChanged || coordsMissing)) {
    const geo = await geocodeAddress(fullAddress);
    if (geo) {
      nextLat = geo.lat.toString();
      nextLng = geo.lng.toString();
      coordsJustSet = coordsMissing;
    }
  }

  const updates = {
    title: readString(formData, "title"),
    address: newAddress,
    city: newCity,
    state: newState,
    zipCode: newZip,
    latitude: nextLat,
    longitude: nextLng,
    bedrooms: readNumericString(formData, "bedrooms"),
    bathrooms: readNumericString(formData, "bathrooms"),
    squareFeet: readInt(formData, "squareFeet"),
    priceUsd: readInt(formData, "priceUsd"),
    description: readString(formData, "description"),
    updatedAt: new Date(),
  };

  const result = await db
    .update(listings)
    .set(updates)
    .where(and(eq(listings.id, listingId), scope))
    .returning({ id: listings.id });

  if (result.length === 0) {
    return { kind: "error", message: "Couldn't update — not in your scope." };
  }

  // If we just populated coordinates that were previously missing, kick off
  // a transit-distance compute so the detail page Transit times section
  // fills in without needing a separate Refresh.
  if (coordsJustSet) {
    const poiIds = await getPoiIdsInScope({ userId, orgId });
    if (poiIds.length > 0) {
      await ensureDistances([listingId], poiIds);
    }
  }

  redirect(`/listings/${listingId}`);
}
