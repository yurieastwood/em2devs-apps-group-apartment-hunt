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
      <UrlField />
      <SubmitButton />
      {state.kind === "error" ? (
        <p className="text-red-600 text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}

function UrlField() {
  const { pending } = useFormStatus();
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">Listing URL</span>
      <input
        type="url"
        name="url"
        required
        disabled={pending}
        placeholder="https://www.zillow.com/homedetails/..."
        className="border border-gray-300 rounded p-2 font-mono text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
      <span className="text-xs text-gray-500">Zillow or Apartments.com.</span>
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
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded px-4 py-2 inline-flex items-center gap-2"
      >
        {pending ? <Spinner /> : null}
        {pending ? "Adding listing…" : "Add listing"}
      </button>
      {pending ? (
        <p className="text-sm text-gray-600">
          Fetching the listing and saving photos. Usually 10–15 seconds — please
          don&apos;t close this tab.
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
