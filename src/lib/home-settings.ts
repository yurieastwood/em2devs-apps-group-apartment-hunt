import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { homeSettings, type HomeSettings } from "@/db/schema";

export type Scope = {
  userId: string;
  orgId: string | null | undefined;
};

// Active org → there's one shared home address per org. Personal mode →
// per-user home where org_id IS NULL.
function scopeWhere(scope: Scope) {
  if (scope.orgId) return eq(homeSettings.orgId, scope.orgId);
  return and(
    eq(homeSettings.ownerClerkUserId, scope.userId),
    isNull(homeSettings.orgId),
  );
}

export async function getHome(scope: Scope): Promise<HomeSettings | null> {
  const [row] = await db
    .select()
    .from(homeSettings)
    .where(scopeWhere(scope)!)
    .orderBy(desc(homeSettings.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function setHome(
  scope: Scope,
  address: string,
  lat: number,
  lng: number,
): Promise<void> {
  const existing = await getHome(scope);
  if (existing) {
    await db
      .update(homeSettings)
      .set({
        homeAddress: address,
        homeLat: lat.toString(),
        homeLng: lng.toString(),
        updatedAt: new Date(),
      })
      .where(eq(homeSettings.id, existing.id));
    return;
  }
  await db.insert(homeSettings).values({
    ownerClerkUserId: scope.userId,
    orgId: scope.orgId ?? null,
    homeAddress: address,
    homeLat: lat.toString(),
    homeLng: lng.toString(),
  });
}
