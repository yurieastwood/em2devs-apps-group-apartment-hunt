"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createListingManuallyAction, type ActionState } from "./actions";

const initialActionState: ActionState = { kind: "idle" };

export function ManualForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createListingManuallyAction,
    initialActionState,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Title"
        name="title"
        placeholder="Optional — defaults to the address"
      />
      <Field
        label="Address"
        name="address"
        required
        placeholder="2341 W Adams St, Unit 2E"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="City" name="city" placeholder="Chicago" />
        <Field label="State" name="state" placeholder="IL" />
        <Field label="ZIP" name="zipCode" placeholder="60612" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Bedrooms" name="bedrooms" inputMode="decimal" />
        <Field label="Bathrooms" name="bathrooms" inputMode="decimal" />
        <Field label="Sq ft" name="squareFeet" type="number" />
        <Field label="Price (USD/mo)" name="priceUsd" type="number" />
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={6}
          placeholder="Notes from your visit, contact info, anything worth remembering…"
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Photos</span>
        <input
          type="file"
          name="photos"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted/70"
        />
        <span className="text-xs text-muted-foreground">
          Optional. JPEG, PNG, WebP, or GIF — snap them on your phone and upload
          here.
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        We&apos;ll geocode the address to place it on the map and compute its
        safety score. You can edit any field later.
      </p>
      <SubmitButton />
      {state.kind === "error" ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
};

function Field({
  label,
  name,
  required,
  placeholder,
  type = "text",
  inputMode,
}: FieldProps) {
  const { pending } = useFormStatus();
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={pending}
        className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground disabled:opacity-60"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 items-start">
      <button
        type="submit"
        disabled={pending}
        className="bg-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground rounded px-4 py-2"
      >
        {pending ? "Adding listing…" : "Add listing"}
      </button>
      {pending ? (
        <p className="text-sm text-muted-foreground">
          Geocoding the address and uploading photos — please don&apos;t close
          this tab.
        </p>
      ) : null}
    </div>
  );
}
