import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pointsOfInterest, type PointOfInterest } from "@/db/schema";

export async function getUserPois(
  clerkUserId: string,
): Promise<PointOfInterest[]> {
  return db
    .select()
    .from(pointsOfInterest)
    .where(eq(pointsOfInterest.ownerClerkUserId, clerkUserId))
    .orderBy(asc(pointsOfInterest.createdAt));
}

export async function insertPoi(values: {
  ownerClerkUserId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(pointsOfInterest)
    .values({
      ownerClerkUserId: values.ownerClerkUserId,
      label: values.label,
      address: values.address,
      lat: values.lat.toString(),
      lng: values.lng.toString(),
    })
    .returning({ id: pointsOfInterest.id });
  return inserted;
}

export async function updatePoi(
  id: string,
  ownerClerkUserId: string,
  values: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  },
): Promise<{ id: string } | null> {
  const [updated] = await db
    .update(pointsOfInterest)
    .set({
      label: values.label,
      address: values.address,
      lat: values.lat.toString(),
      lng: values.lng.toString(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pointsOfInterest.id, id),
        eq(pointsOfInterest.ownerClerkUserId, ownerClerkUserId),
      ),
    )
    .returning({ id: pointsOfInterest.id });
  return updated ?? null;
}

export async function deletePoiById(
  id: string,
  ownerClerkUserId: string,
): Promise<boolean> {
  const result = await db
    .delete(pointsOfInterest)
    .where(
      and(
        eq(pointsOfInterest.id, id),
        eq(pointsOfInterest.ownerClerkUserId, ownerClerkUserId),
      ),
    )
    .returning({ id: pointsOfInterest.id });
  return result.length > 0;
}
