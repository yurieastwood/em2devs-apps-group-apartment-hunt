"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  deletePoiAction,
  type PoiState,
  updatePoiAction,
} from "@/lib/poi-actions";
import { poiPinColor } from "@/lib/poi-pin-color";
import { PoiColorPicker } from "./poi-color-picker";

const initial: PoiState = { kind: "idle" };

type Props = {
  poi: {
    id: string;
    label: string;
    address: string;
    color: string | null;
  };
  canEdit: boolean;
};

export function PoiRow({ poi, canEdit }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EditForm poi={poi} onClose={() => setEditing(false)} />;
  }

  const color = poiPinColor(poi.color);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
      <span
        aria-hidden
        className="inline-block w-3 h-3 rounded-full self-center"
        style={{ backgroundColor: color.background }}
      />
      <span>
        <strong>{poi.label}:</strong>{" "}
        <span className="text-muted-foreground">{poi.address}</span>
      </span>
      {canEdit ? (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-primary hover:underline text-xs"
          >
            Edit
          </button>
          <DeletePoiButton poiId={poi.id} />
        </>
      ) : null}
    </div>
  );
}

function EditForm({
  poi,
  onClose,
}: {
  poi: Props["poi"];
  onClose: () => void;
}) {
  const action = updatePoiAction.bind(null, poi.id);
  const [state, formAction] = useActionState<PoiState, FormData>(
    action,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          name="label"
          required
          defaultValue={poi.label}
          placeholder="Label"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm"
        />
        <input
          type="text"
          name="address"
          required
          defaultValue={poi.address}
          placeholder="Address"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm"
        />
      </div>
      <PoiColorPicker defaultValue={poi.color} />
      <div className="flex items-center gap-3">
        <SaveButton />
        <button
          type="button"
          onClick={onClose}
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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground rounded px-3 py-1.5 text-sm"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function DeletePoiButton({ poiId }: { poiId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Delete this point of interest?")) return;
        startTransition(() => deletePoiAction(poiId));
      }}
      disabled={pending}
      className="text-destructive hover:underline text-xs disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
