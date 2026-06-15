"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addListingPhotosAction, type AddPhotosState } from "./photo-actions";

const initial: AddPhotosState = { status: "idle" };

export function AddPhotos({ listingId }: { listingId: string }) {
  const action = addListingPhotosAction.bind(null, listingId);
  const [state, formAction] = useActionState<AddPhotosState, FormData>(
    action,
    initial,
  );

  return (
    <details className="my-6 rounded border border-border p-4">
      <summary className="cursor-pointer font-medium">Add photos</summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">From your device</span>
          <input
            type="file"
            name="photos"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted/70"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">From image URLs</span>
          <textarea
            name="urls"
            rows={3}
            placeholder="One image URL per line (or comma-separated)"
            className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
          />
        </label>
        <SubmitButton />
        {state.status === "done" ? (
          <p className="text-sm text-muted-foreground">
            Added {state.added} photo{state.added === 1 ? "" : "s"}
            {state.failed > 0 ? ` · ${state.failed} failed` : ""}.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}
      </form>
    </details>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start bg-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground rounded px-4 py-2 text-sm"
    >
      {pending ? "Adding…" : "Add photos"}
    </button>
  );
}
