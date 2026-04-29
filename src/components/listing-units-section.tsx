"use client";

import { useTransition } from "react";
import { setHeadlineUnitAction } from "@/lib/listings/headline-actions";
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

function isCurrentHeadline(
  u: ParsedUnit,
  headlineBeds: number | null,
  headlineBaths: number | null,
  headlineSqft: number | null,
  headlinePrice: number | null,
): boolean {
  return (
    u.beds === headlineBeds &&
    u.baths === headlineBaths &&
    u.sqft === headlineSqft &&
    u.price === headlinePrice
  );
}

export function ListingUnitsSection({
  listingId,
  units,
  headlineBeds,
  headlineBaths,
  headlineSqft,
  headlinePrice,
}: {
  listingId: string;
  units: unknown;
  headlineBeds: number | null;
  headlineBaths: number | null;
  headlineSqft: number | null;
  headlinePrice: number | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!Array.isArray(units) || units.length === 0) return null;

  // Parser already deduped and sorted by price asc; just render in order.
  const typedUnits = units as ParsedUnit[];

  function pickHeadline(u: ParsedUnit) {
    startTransition(async () => {
      await setHeadlineUnitAction(
        listingId,
        u.beds,
        u.baths,
        u.sqft,
        u.price,
      );
    });
  }

  return (
    <section className="mb-6 border border-border rounded">
      <header className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-medium">Available units</h2>
        <span className="text-xs text-muted-foreground">
          {typedUnits.length} distinct floor plan
          {typedUnits.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="divide-y divide-border">
        {typedUnits.map((u, i) => {
          const isHeadline = isCurrentHeadline(
            u,
            headlineBeds,
            headlineBaths,
            headlineSqft,
            headlinePrice,
          );
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
              <span className="font-semibold">
                {fmtPrice(u.price) ?? "Ask for price"}
              </span>
              {u.availableFrom ? (
                <span className="text-xs text-muted-foreground">
                  Available: {u.availableFrom}
                </span>
              ) : null}
              <span className="ml-auto">
                {isHeadline ? (
                  <span className="text-xs text-primary font-medium">
                    ✓ Default
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => pickHeadline(u)}
                    disabled={pending}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Set as default"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
