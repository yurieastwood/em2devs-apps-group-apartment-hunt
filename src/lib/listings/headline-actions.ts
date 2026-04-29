"use server";

import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { userCanAccessListing } from "./access";

export type SetHeadlineResult =
  | { ok: true }
  | { ok: false; reason: string };

// Picks a specific (beds, baths, sqft, price) tuple from a listing's units
// array as the headline shown on the home page card. Family-wide — anyone
// in the org can change it (same policy as priority).
export async function setHeadlineUnitAction(
  listingId: string,
  beds: number | null,
  baths: number | null,
  sqft: number | null,
  price: number | null,
): Promise<SetHeadlineResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const [target] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!target || !userCanAccessListing(target, { userId, orgId })) {
    return { ok: false, reason: "Listing not found" };
  }

  await db
    .update(listings)
    .set({
      bedrooms: beds != null ? beds.toString() : null,
      bathrooms: baths != null ? baths.toString() : null,
      squareFeet: sqft,
      priceUsd: price,
      headlineLocked: true,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  revalidatePath("/");
  revalidatePath("/listings/[id]", "page");
  return { ok: true };
}
