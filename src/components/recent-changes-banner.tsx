import Link from "next/link";
import { and, desc, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges, listings } from "@/db/schema";

export const RECENT_CHANGES_WINDOW_HOURS = 24;

export type RecentChange = {
  id: string;
  listingId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  listingLabel: string;
};

// Async data fetcher kept outside any component so the React purity rule
// doesn't flag the `Date.now()` call below.
export async function getRecentChanges(
  scopedListingIds: string[],
  windowHours: number = RECENT_CHANGES_WINDOW_HOURS,
): Promise<RecentChange[]> {
  if (scopedListingIds.length === 0) return [];

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: listingChanges.id,
      listingId: listingChanges.listingId,
      field: listingChanges.field,
      oldValue: listingChanges.oldValue,
      newValue: listingChanges.newValue,
      changedAt: listingChanges.changedAt,
    })
    .from(listingChanges)
    .where(
      and(
        inArray(listingChanges.listingId, scopedListingIds),
        gte(listingChanges.changedAt, since),
      ),
    )
    .orderBy(desc(listingChanges.changedAt))
    .limit(20);

  if (rows.length === 0) return [];

  const affectedIds = Array.from(new Set(rows.map((r) => r.listingId)));
  const listingRows = await db
    .select({
      id: listings.id,
      address: listings.address,
      title: listings.title,
    })
    .from(listings)
    .where(inArray(listings.id, affectedIds));
  const labelById = new Map(
    listingRows.map((l) => [l.id, l.address ?? l.title ?? "Listing"]),
  );

  return rows.map((r) => ({
    ...r,
    listingLabel: labelById.get(r.listingId) ?? "Listing",
  }));
}

function fmtPrice(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `$${n.toLocaleString("en-US")}/mo`;
}

function formatChange(
  field: string,
  oldValue: string | null,
  newValue: string | null,
): string {
  if (field === "price") {
    return `${fmtPrice(oldValue)} → ${fmtPrice(newValue)}`;
  }
  return `${oldValue ?? "—"} → ${newValue ?? "—"}`;
}

function fieldLabel(field: string): string {
  if (field === "safetyScore") return "Safety";
  if (field === "price") return "Price";
  if (field === "availability") return "Availability";
  return field;
}

export function RecentChangesBanner({
  changes,
}: {
  changes: RecentChange[];
}) {
  if (changes.length === 0) return null;
  return (
    <details className="mb-6 rounded border border-primary/40 bg-primary/5 p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {changes.length} change{changes.length === 1 ? "" : "s"} in the last{" "}
        {RECENT_CHANGES_WINDOW_HOURS}h
      </summary>
      <ul className="mt-2 space-y-1">
        {changes.map((c) => (
          <li key={c.id} className="text-muted-foreground">
            <Link
              href={`/listings/${c.listingId}`}
              className="text-foreground hover:underline"
            >
              {c.listingLabel}
            </Link>{" "}
            <span className="text-xs">
              · {fieldLabel(c.field)}:{" "}
              {formatChange(c.field, c.oldValue, c.newValue)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
