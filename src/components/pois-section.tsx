import { auth } from "@clerk/nextjs/server";
import { getPois } from "@/lib/points-of-interest";
import { PoiRow } from "./poi-row";
import { AddPoiForm } from "./add-poi-form";

export async function PoisSection({ canEdit }: { canEdit: boolean }) {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const pois = await getPois({ userId, orgId });

  if (pois.length === 0 && !canEdit) return null;

  return (
    <div className="mb-3">
      <p className="text-sm font-medium mb-2">Points of interest</p>
      {pois.length > 0 ? (
        <ul className="space-y-2 mb-2">
          {pois.map((poi) => (
            <li key={poi.id}>
              <PoiRow
                key={poi.id}
                poi={{
                  id: poi.id,
                  label: poi.label,
                  address: poi.address,
                  color: poi.color,
                }}
                canEdit={canEdit}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">
          None yet. Add places like Work, school, or family — distances from
          each listing via transit will appear on the map and the listing
          cards.
        </p>
      )}
      {canEdit ? <AddPoiForm key={`add-${pois.length}`} /> : null}
    </div>
  );
}
