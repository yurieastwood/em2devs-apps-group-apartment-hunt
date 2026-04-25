"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Listing } from "@/db/schema";
import { updateListingAction, type EditState } from "./actions";

const initial: EditState = { kind: "idle" };

export function EditListingForm({ listing }: { listing: Listing }) {
  const action = updateListingAction.bind(null, listing.id);
  const [state, formAction] = useActionState<EditState, FormData>(
    action,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Title" name="title" defaultValue={listing.title ?? ""} />
      <Field
        label="Address"
        name="address"
        defaultValue={listing.address ?? ""}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="City" name="city" defaultValue={listing.city ?? ""} />
        <Field label="State" name="state" defaultValue={listing.state ?? ""} />
        <Field
          label="ZIP"
          name="zipCode"
          defaultValue={listing.zipCode ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field
          label="Bedrooms"
          name="bedrooms"
          inputMode="decimal"
          defaultValue={listing.bedrooms ?? ""}
        />
        <Field
          label="Bathrooms"
          name="bathrooms"
          inputMode="decimal"
          defaultValue={listing.bathrooms ?? ""}
        />
        <Field
          label="Sq ft"
          name="squareFeet"
          type="number"
          defaultValue={listing.squareFeet?.toString() ?? ""}
        />
        <Field
          label="Price (USD/mo)"
          name="priceUsd"
          type="number"
          defaultValue={listing.priceUsd?.toString() ?? ""}
        />
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={8}
          defaultValue={listing.description ?? ""}
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
        />
      </label>
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
  defaultValue?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
};

function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  inputMode,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start bg-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground rounded px-4 py-2"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
