import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { labels, listingLabels } from "@/db/schema";
import { listLabelsInScope } from "@/lib/listings/labels";
import { LabelsEditor } from "./labels-editor";

export async function ListingLabelsSection({
  listingId,
}: {
  listingId: string;
}) {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const [scopeLabels, applied] = await Promise.all([
    listLabelsInScope({ userId, orgId }),
    db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(listingLabels)
      .innerJoin(labels, eq(labels.id, listingLabels.labelId))
      .where(eq(listingLabels.listingId, listingId)),
  ]);

  return (
    <div className="mt-6">
      <LabelsEditor
        listingId={listingId}
        appliedLabels={applied.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        }))}
        scopeLabels={scopeLabels.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        }))}
      />
    </div>
  );
}
