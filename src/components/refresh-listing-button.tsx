"use client";

import { useState, useTransition } from "react";
import { refreshListingAction } from "@/lib/listings/refresh-actions";

export function RefreshListingButton({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshListingAction(listingId);
      if (!result.ok) {
        setMessage(result.reason);
        return;
      }
      const o = result.outcome;
      if (o.kind === "ok") {
        setMessage(o.changes > 0 ? `${o.changes} change(s)` : "No changes");
      } else if (o.kind === "fetch_failed") {
        setMessage(`Fetch failed (HTTP ${o.status})`);
      } else if (o.kind === "unsupported_host") {
        setMessage(`Unsupported host: ${o.host}`);
      } else {
        setMessage("Listing not found");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={
          className ??
          "text-sm text-muted-foreground hover:text-foreground hover:underline disabled:opacity-60"
        }
      >
        {pending ? "Refreshing…" : "Refresh now"}
      </button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </span>
  );
}
