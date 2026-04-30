"use client";

import { useTransition } from "react";
import { setViewModeAction } from "@/lib/view-mode-actions";
import type { ViewMode } from "@/lib/view-mode";

export function ViewModeToggle({ current }: { current: ViewMode }) {
  const [pending, startTransition] = useTransition();

  const setMode = (mode: ViewMode) => {
    if (mode === current) return;
    startTransition(() => setViewModeAction(mode));
  };

  return (
    <div className="inline-flex items-center border border-border rounded overflow-hidden text-sm">
      <ToggleButton
        active={current === "cards"}
        disabled={pending}
        onClick={() => setMode("cards")}
        label="Cards"
      />
      <ToggleButton
        active={current === "list"}
        disabled={pending}
        onClick={() => setMode("list")}
        label="List"
      />
      <ToggleButton
        active={current === "table"}
        disabled={pending}
        onClick={() => setMode("table")}
        label="Table"
      />
    </div>
  );
}

function ToggleButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`px-3 py-1 transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      } disabled:opacity-60`}
    >
      {label}
    </button>
  );
}
