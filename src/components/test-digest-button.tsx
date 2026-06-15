"use client";

import { useState, useTransition } from "react";
import { sendTestDigestAction } from "@/lib/listings/refresh-actions";

export function TestDigestButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestDigestAction();
      if (!result.ok) {
        setMessage(result.reason);
        return;
      }
      if (result.channels.length === 0) {
        setMessage("No channels configured");
        return;
      }
      setMessage(
        result.channels
          .map((c) =>
            c.detail ? `${c.channel}: ${c.status} (${c.detail})` : `${c.channel}: ${c.status}`,
          )
          .join(" · "),
      );
    });
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title="Send a test message to the configured digest channels"
        className="border border-border hover:bg-muted px-3 py-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {pending ? "Sending test…" : "Test digest"}
      </button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </span>
  );
}
