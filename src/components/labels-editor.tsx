"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  applyLabelAction,
  createLabelAction,
  deleteLabelAction,
  removeLabelAction,
  type LabelActionState,
} from "@/lib/listings/labels-actions";
import { LABEL_COLORS, labelChipClasses } from "@/lib/label-color";

const initial: LabelActionState = { kind: "idle" };

type LabelLite = { id: string; name: string; color: string | null };

type Props = {
  listingId: string;
  appliedLabels: LabelLite[];
  scopeLabels: LabelLite[];
};

export function LabelsEditor({ listingId, appliedLabels, scopeLabels }: Props) {
  const [picking, setPicking] = useState(false);
  const appliedIds = new Set(appliedLabels.map((l) => l.id));
  const unapplied = scopeLabels.filter((l) => !appliedIds.has(l.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {appliedLabels.map((l) => (
        <AppliedLabelChip key={l.id} label={l} listingId={listingId} />
      ))}
      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-xs text-primary hover:underline"
        >
          + Add label
        </button>
      ) : (
        <PickerPanel
          listingId={listingId}
          unapplied={unapplied}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function AppliedLabelChip({
  label,
  listingId,
}: {
  label: LabelLite;
  listingId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${labelChipClasses(label.color)}`}
    >
      {label.name}
      <button
        type="button"
        aria-label={`Remove ${label.name}`}
        onClick={() =>
          startTransition(() => removeLabelAction(listingId, label.id))
        }
        disabled={pending}
        className="opacity-60 hover:opacity-100 disabled:opacity-30"
      >
        ×
      </button>
    </span>
  );
}

function PickerPanel({
  listingId,
  unapplied,
  onClose,
}: {
  listingId: string;
  unapplied: LabelLite[];
  onClose: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border border-border rounded p-2 bg-muted/30">
      {unapplied.length > 0 ? (
        unapplied.map((l) => (
          <ApplyLabelButton key={l.id} listingId={listingId} label={l} />
        ))
      ) : (
        <span className="text-xs text-muted-foreground">
          No more labels — create one.
        </span>
      )}
      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs text-primary hover:underline ml-1"
        >
          + New label
        </button>
      ) : (
        <CreateLabelForm onDone={() => setShowCreate(false)} />
      )}
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground ml-1"
      >
        Done
      </button>
    </div>
  );
}

function ApplyLabelButton({
  listingId,
  label,
}: {
  listingId: string;
  label: LabelLite;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => applyLabelAction(listingId, label.id))
      }
      disabled={pending}
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs hover:opacity-80 disabled:opacity-50 ${labelChipClasses(label.color)}`}
    >
      {label.name}
    </button>
  );
}

function CreateLabelForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState<LabelActionState, FormData>(
    createLabelAction,
    initial,
  );
  const [color, setColor] = useState<string>("gray");

  // Close after successful create — parent re-renders via revalidatePath,
  // so the new label appears in the list.
  if (state.kind === "saved") {
    queueMicrotask(onDone);
  }

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input
        type="text"
        name="name"
        required
        maxLength={40}
        placeholder="Name"
        className="border border-border bg-input-background text-foreground rounded px-2 py-0.5 text-xs"
      />
      <input type="hidden" name="color" value={color} />
      <ColorPicker value={color} onChange={setColor} />
      <SubmitButton />
      {state.kind === "error" ? (
        <span className="text-destructive text-xs ml-1">{state.message}</span>
      ) : null}
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={`w-4 h-4 rounded-full border ${labelChipClasses(c)} ${value === c ? "ring-2 ring-foreground/40" : ""}`}
        />
      ))}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs disabled:opacity-60"
    >
      {pending ? "…" : "Add"}
    </button>
  );
}

export function LabelsManagementList({
  scopeLabels,
}: {
  scopeLabels: LabelLite[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <ul className="flex flex-wrap gap-2">
      {scopeLabels.map((l) => (
        <li
          key={l.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${labelChipClasses(l.color)}`}
        >
          {l.name}
          <button
            type="button"
            aria-label={`Delete label ${l.name}`}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete the "${l.name}" label? It will be removed from every listing it's on.`,
                )
              ) {
                return;
              }
              startTransition(() => deleteLabelAction(l.id));
            }}
            disabled={pending}
            className="opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
