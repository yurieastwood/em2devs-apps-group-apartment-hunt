"use client";

import { useState, useTransition } from "react";
import { setListingPriorityAction } from "@/lib/listings/priority-actions";

type Props = {
  listingId: string;
  current: number | null;
  className?: string;
};

// Inline number input that doubles as both display and editor. Empty value
// means the listing is unprioritized. Parent components should re-key on
// `current` so a server reorder forces a fresh useState init.
export function PriorityEditor({ listingId, current, className }: Props) {
  const [value, setValue] = useState(current?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit(input: string) {
    setError(null);
    const trimmed = input.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1)) {
      setValue(current?.toString() ?? "");
      setError("≥ 1");
      return;
    }
    if (parsed === current) {
      return;
    }

    startTransition(async () => {
      const result = await setListingPriorityAction(listingId, parsed);
      if (!result.ok) {
        setError(result.reason ?? "Failed");
        setValue(current?.toString() ?? "");
      }
    });
  }

  return (
    <span
      className={
        className ?? "inline-flex items-center gap-1 text-xs whitespace-nowrap"
      }
    >
      <span className="text-muted-foreground">P</span>
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(current?.toString() ?? "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={pending}
        placeholder="—"
        aria-label="Priority"
        title="Priority (leave empty to unprioritize)"
        className="w-10 text-center border border-border bg-input-background text-foreground rounded px-1 py-0.5 disabled:opacity-50 focus:outline-none focus:border-primary"
      />
      {error ? (
        <span className="text-destructive text-[10px]">{error}</span>
      ) : null}
    </span>
  );
}
