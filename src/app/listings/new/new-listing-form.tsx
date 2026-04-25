"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createListingAction, type ActionState } from "./actions";

const initialActionState: ActionState = { kind: "idle" };

export function NewListingForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createListingAction,
    initialActionState,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Listing URL</span>
        <input
          type="url"
          name="url"
          required
          placeholder="https://www.zillow.com/homedetails/..."
          className="border border-gray-300 rounded p-2 font-mono text-sm"
        />
        <span className="text-xs text-gray-500">
          Zillow or Apartments.com.
        </span>
      </label>
      <SubmitButton />
      {state.kind === "error" ? (
        <p className="text-red-600 text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded px-4 py-2"
    >
      {pending ? "Adding…" : "Add listing"}
    </button>
  );
}
