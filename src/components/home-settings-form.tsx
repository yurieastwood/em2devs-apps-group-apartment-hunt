"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  setHomeAction,
  type SetHomeState,
} from "@/lib/user-settings-actions";

const initial: SetHomeState = { kind: "idle" };

// Parent passes `key={currentAddress}` so this component remounts after a
// successful save — that's how `editing` flips back to false without a
// useEffect that React's linter discourages.
export function HomeSettingsForm({
  currentAddress,
}: {
  currentAddress: string | null;
}) {
  const [state, action] = useActionState<SetHomeState, FormData>(
    setHomeAction,
    initial,
  );
  const [editing, setEditing] = useState(!currentAddress);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 flex-wrap">
        <span>
          <span className="text-foreground font-medium">Your home:</span>{" "}
          {currentAddress}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 mb-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {currentAddress ? "Update your home address" : "Set your home address"}
        </span>
        <span className="text-xs text-muted-foreground">
          The map below will center on this and show distance from each listing.
        </span>
        <input
          type="text"
          name="address"
          required
          defaultValue={currentAddress ?? ""}
          placeholder="123 Main St, Chicago, IL"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton hasExisting={!!currentAddress} />
        {currentAddress ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
        {state.kind === "error" ? (
          <span className="text-destructive text-sm">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton({ hasExisting }: { hasExisting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground rounded px-3 py-1.5 text-sm"
    >
      {pending ? "Saving…" : hasExisting ? "Save" : "Set home"}
    </button>
  );
}
