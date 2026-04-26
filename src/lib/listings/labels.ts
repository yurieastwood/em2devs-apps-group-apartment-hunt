import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { labels, listingLabels, type Label } from "@/db/schema";

export type LabelScope = {
  userId: string;
  orgId: string | null | undefined;
};

// Same scope semantics as listings: in an org → labels.org_id = org;
// personal → labels.org_id IS NULL AND owner = user.
function scopeWhere(scope: LabelScope) {
  if (scope.orgId) {
    return eq(labels.orgId, scope.orgId);
  }
  return and(eq(labels.ownerClerkUserId, scope.userId), isNull(labels.orgId));
}

export async function listLabelsInScope(scope: LabelScope): Promise<Label[]> {
  return db
    .select()
    .from(labels)
    .where(scopeWhere(scope))
    .orderBy(asc(labels.name));
}

export async function createLabelInScope(
  scope: LabelScope,
  name: string,
  color: string | null,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(labels)
    .values({
      ownerClerkUserId: scope.userId,
      orgId: scope.orgId ?? null,
      name,
      color,
    })
    .returning({ id: labels.id });
  return row;
}

export async function deleteLabelInScope(
  scope: LabelScope,
  labelId: string,
): Promise<boolean> {
  const result = await db
    .delete(labels)
    .where(and(eq(labels.id, labelId), scopeWhere(scope)!))
    .returning({ id: labels.id });
  return result.length > 0;
}

export async function getLabelInScope(
  scope: LabelScope,
  labelId: string,
): Promise<Label | null> {
  const [row] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, labelId), scopeWhere(scope)!))
    .limit(1);
  return row ?? null;
}

export async function getLabelsForListings(
  listingIds: string[],
): Promise<Map<string, Label[]>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db
    .select({
      listingId: listingLabels.listingId,
      label: labels,
    })
    .from(listingLabels)
    .innerJoin(labels, eq(labels.id, listingLabels.labelId))
    .where(inArray(listingLabels.listingId, listingIds));
  const map = new Map<string, Label[]>();
  for (const r of rows) {
    const arr = map.get(r.listingId) ?? [];
    arr.push(r.label);
    map.set(r.listingId, arr);
  }
  return map;
}

export async function applyLabelToListing(
  listingId: string,
  labelId: string,
): Promise<void> {
  await db
    .insert(listingLabels)
    .values({ listingId, labelId })
    .onConflictDoNothing();
}

export async function removeLabelFromListing(
  listingId: string,
  labelId: string,
): Promise<void> {
  await db
    .delete(listingLabels)
    .where(
      and(
        eq(listingLabels.listingId, listingId),
        eq(listingLabels.labelId, labelId),
      ),
    );
}
