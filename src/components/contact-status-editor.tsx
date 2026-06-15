"use client";

import { useState, useTransition } from "react";
import { setContactStatusAction } from "@/lib/listings/contact-status-actions";
import {
  CONTACT_STATUSES,
  isContactStatus,
  type ContactStatus,
} from "@/lib/listings/contact-status";

type Props = {
  listingId: string;
  current: string | null;
  className?: string;
};

// Visual accent per status so the select is scannable at a glance. Empty
// (no contact yet) stays neutral.
const STATUS_CLASS: Record<ContactStatus, string> = {
  contacted: "border-sky-500/50 text-sky-700 dark:text-sky-400",
  visited: "border-violet-500/50 text-violet-700 dark:text-violet-400",
  applied: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400",
  discarded: "border-border text-muted-foreground line-through",
};

// Inline select that doubles as both display and editor. Parent components
// should re-key on `current` so a server update forces a fresh useState init.
export function ContactStatusEditor({ listingId, current, className }: Props) {
  const initial = current && isContactStatus(current) ? current : "";
  const [value, setValue] = useState<ContactStatus | "">(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit(next: ContactStatus | "") {
    setError(null);
    const status = next === "" ? null : next;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setContactStatusAction(listingId, status);
      if (!result.ok) {
        setError(result.reason ?? "Failed");
        setValue(previous);
      }
    });
  }

  const accent = value ? STATUS_CLASS[value] : "border-border";

  return (
    <span
      className={
        className ?? "inline-flex items-center gap-1 text-xs whitespace-nowrap"
      }
    >
      <select
        value={value}
        onChange={(e) => commit(e.target.value as ContactStatus | "")}
        disabled={pending}
        aria-label="Contact status"
        title="Contact status"
        className={`rounded border bg-input-background px-1.5 py-0.5 disabled:opacity-50 focus:outline-none focus:border-primary ${accent}`}
      >
        <option value="">— Status</option>
        {CONTACT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-destructive text-[10px]">{error}</span>
      ) : null}
    </span>
  );
}
