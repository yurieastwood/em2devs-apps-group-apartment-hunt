import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges } from "@/db/schema";

function formatPrice(value: string | null): string {
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
    return `Price: ${formatPrice(oldValue)} → ${formatPrice(newValue)}`;
  }
  if (field === "availability") {
    return `Availability: ${oldValue ?? "—"} → ${newValue ?? "—"}`;
  }
  if (field === "safetyScore") {
    return `Safety score: ${oldValue ?? "—"} → ${newValue ?? "—"}`;
  }
  return `${field}: ${oldValue ?? "—"} → ${newValue ?? "—"}`;
}

function formatWhen(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function ListingChangesLog({ listingId }: { listingId: string }) {
  const rows = await db
    .select()
    .from(listingChanges)
    .where(eq(listingChanges.listingId, listingId))
    .orderBy(desc(listingChanges.changedAt))
    .limit(50);

  if (rows.length === 0) {
    return (
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Change history (0)
        </summary>
        <p className="mt-2 text-muted-foreground">
          No changes recorded yet.
        </p>
      </details>
    );
  }

  return (
    <details className="mt-6 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Change history ({rows.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="text-muted-foreground">
            <span className="text-foreground">
              {formatChange(r.field, r.oldValue, r.newValue)}
            </span>{" "}
            <span className="text-xs">
              · {formatWhen(r.changedAt)} · {r.source}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
