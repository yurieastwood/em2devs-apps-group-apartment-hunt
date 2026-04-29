import type { ParsedUnit } from "@/lib/extract/types";

function fmtBedsBaths(beds: number | null, baths: number | null): string {
  const parts: string[] = [];
  if (beds != null) parts.push(`${beds} BR`);
  if (baths != null) parts.push(`${baths} BA`);
  return parts.join(" · ");
}

function fmtSqft(n: number | null): string | null {
  return n == null ? null : `${n.toLocaleString("en-US")} sq ft`;
}

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

function isHeadlineCandidate(u: ParsedUnit): boolean {
  return u.beds === 3 && u.baths === 2 && u.price != null && u.price > 0;
}

// Server component — renders nothing when units is null/empty so callers can
// drop it in unconditionally on the detail page.
export function ListingUnitsSection({
  units,
  headlinePrice,
}: {
  units: unknown;
  headlinePrice: number | null;
}) {
  if (!Array.isArray(units) || units.length === 0) return null;

  // The headline unit is the one shown at the top of the detail page; we
  // highlight matching rows here so the user can spot it in the list.
  const typedUnits = units as ParsedUnit[];
  const sorted = [...typedUnits].sort(
    (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  );

  return (
    <section className="mb-6 border border-border rounded">
      <header className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-medium">Available units</h2>
        <span className="text-xs text-muted-foreground">
          {typedUnits.length} unit{typedUnits.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="divide-y divide-border">
        {sorted.map((u, i) => {
          const isHeadline =
            isHeadlineCandidate(u) && u.price === headlinePrice;
          return (
            <li
              key={i}
              className={`px-4 py-2 text-sm flex flex-wrap items-baseline gap-x-4 gap-y-1 ${
                isHeadline ? "bg-primary/10" : ""
              }`}
            >
              <span className="font-medium min-w-32">
                {u.name ?? fmtBedsBaths(u.beds, u.baths) ?? "Unit"}
              </span>
              <span className="text-muted-foreground">
                {fmtBedsBaths(u.beds, u.baths) || "—"}
              </span>
              {u.sqft != null ? (
                <span className="text-muted-foreground">{fmtSqft(u.sqft)}</span>
              ) : null}
              <span className="font-semibold ml-auto">
                {fmtPrice(u.price) ?? "Ask for price"}
              </span>
              {u.availableFrom ? (
                <span className="text-xs text-muted-foreground w-full">
                  Available: {u.availableFrom}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
