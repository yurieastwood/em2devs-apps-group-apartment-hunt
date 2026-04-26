import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { pointsOfInterest, type PointOfInterest } from "@/db/schema";

export type Scope = {
  userId: string;
  orgId: string | null | undefined;
};

function scopeWhere(scope: Scope) {
  if (scope.orgId) return eq(pointsOfInterest.orgId, scope.orgId);
  return and(
    eq(pointsOfInterest.ownerClerkUserId, scope.userId),
    isNull(pointsOfInterest.orgId),
  );
}

export async function getPois(scope: Scope): Promise<PointOfInterest[]> {
  return db
    .select()
    .from(pointsOfInterest)
    .where(scopeWhere(scope)!)
    .orderBy(asc(pointsOfInterest.createdAt));
}

export async function insertPoi(
  scope: Scope,
  values: { label: string; address: string; lat: number; lng: number },
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(pointsOfInterest)
    .values({
      ownerClerkUserId: scope.userId,
      orgId: scope.orgId ?? null,
      label: values.label,
      address: values.address,
      lat: values.lat.toString(),
      lng: values.lng.toString(),
    })
    .returning({ id: pointsOfInterest.id });
  return inserted;
}

export async function updatePoi(
  scope: Scope,
  poiId: string,
  values: { label: string; address: string; lat: number; lng: number },
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
    .where(and(eq(pointsOfInterest.id, poiId), scopeWhere(scope)!))
    .returning({ id: pointsOfInterest.id });
  return updated ?? null;
}

export async function deletePoiById(
  scope: Scope,
  poiId: string,
): Promise<boolean> {
  const result = await db
    .delete(pointsOfInterest)
    .where(and(eq(pointsOfInterest.id, poiId), scopeWhere(scope)!))
    .returning({ id: pointsOfInterest.id });
  return result.length > 0;
}
