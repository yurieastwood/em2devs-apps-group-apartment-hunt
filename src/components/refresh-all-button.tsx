"use client";

import { useState, useTransition } from "react";
import { refreshAllListingsAction } from "@/lib/listings/refresh-actions";

export function RefreshAllButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshAllListingsAction();
      if (!result.ok) {
        setMessage(result.reason);
        return;
      }
      const parts = [`${result.total} checked`];
      if (result.changed > 0) parts.push(`${result.changed} changed`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setMessage(parts.join(" · "));
    });
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="border border-border hover:bg-muted px-3 py-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {pending ? "Refreshing all…" : "Refresh all"}
      </button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </span>
  );
}
