"use client";

import { useTransition } from "react";
import { setShowSchoolsAction } from "@/lib/show-schools-actions";

export function ShowSchoolsToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => setShowSchoolsAction(!enabled))
      }
      disabled={pending}
      aria-pressed={enabled}
      className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-60 ${
        enabled
          ? "bg-primary/15 border-primary text-foreground"
          : "border-border hover:bg-muted text-muted-foreground"
      }`}
    >
      {enabled ? "✓ Pre-K schools" : "Show pre-K schools"}
    </button>
  );
}
