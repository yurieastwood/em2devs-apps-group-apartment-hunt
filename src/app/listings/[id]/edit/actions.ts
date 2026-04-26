"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { listingScope } from "@/lib/listings/access";

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

  const scope = listingScope({ userId, orgId });
  if (!scope) {
    return { kind: "error", message: "Couldn't update — no access." };
  }

  const updates = {
    title: readString(formData, "title"),
    address: readString(formData, "address"),
    city: readString(formData, "city"),
    state: readString(formData, "state"),
    zipCode: readString(formData, "zipCode"),
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

  redirect(`/listings/${listingId}`);
}
