"use client";

import { useState, useTransition } from "react";
import { bulkPermanentlyDeleteListingsAction } from "@/lib/listings/trash-actions";
import { TrashRow } from "./trash-row";

type TrashItem = {
  listingId: string;
  title: string;
  address: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  priceUsd: number | null;
  neighborhood: string | null;
  coverUrl: string | null;
  deletedAt: string;
};

export function TrashBrowser({ items }: { items: TrashItem[] }) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkPurge() {
    const count = checkedIds.size;
    if (
      !window.confirm(
        `Permanently delete ${count} listing${count === 1 ? "" : "s"}? Photos and audit history will be removed from storage. This can't be undone.`,
      )
    )
      return;
    const ids = Array.from(checkedIds);
    startBulkTransition(async () => {
      await bulkPermanentlyDeleteListingsAction(ids);
      setCheckedIds(new Set());
    });
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground">Trash is empty.</p>;
  }

  return (
    <>
      <ul className="border border-border rounded divide-y divide-border">
        {items.map((it) => (
          <TrashRow
            key={it.listingId}
            {...it}
            checked={checkedIds.has(it.listingId)}
            onToggleCheck={() => toggleCheck(it.listingId)}
          />
        ))}
      </ul>
      {checkedIds.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-background shadow-xl">
          <span className="text-sm font-medium tabular-nums">
            {checkedIds.size}{" "}
            {checkedIds.size === 1 ? "listing" : "listings"} selected
          </span>
          <button
            type="button"
            onClick={handleBulkPurge}
            disabled={bulkPending}
            className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {bulkPending ? "Deleting…" : "Delete forever"}
          </button>
          <button
            type="button"
            onClick={() => setCheckedIds(new Set())}
            disabled={bulkPending}
            className="text-muted-foreground hover:text-foreground text-lg leading-none disabled:opacity-60 px-1"
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
