"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addPoiAction, type PoiState } from "@/lib/poi-actions";

const initial: PoiState = { kind: "idle" };

// Parent re-keys this component (key = current POI count) after each
// successful save, so the form state, useActionState, and `showForm`
// all reset cleanly without a useEffect.
export function AddPoiForm() {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useActionState<PoiState, FormData>(
    addPoiAction,
    initial,
  );

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="text-sm text-primary hover:underline"
      >
        + Add a point of interest
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          name="label"
          required
          placeholder="Label (e.g., Work)"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
        />
        <input
          type="text"
          name="address"
          required
          placeholder="Address"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        {state.kind === "error" ? (
          <span className="text-destructive text-sm">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground rounded px-3 py-1.5 text-sm"
    >
      {pending ? "Adding…" : "Add point of interest"}
    </button>
  );
}
