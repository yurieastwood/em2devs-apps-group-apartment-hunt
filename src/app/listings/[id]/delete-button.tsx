"use client";

import { useTransition } from "react";
import { deleteListingAction } from "./actions";

export function DeleteButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        "Delete this listing? Photos will be removed from storage. This can't be undone.",
      )
    ) {
      return;
    }
    startTransition(() => deleteListingAction(listingId));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-sm text-destructive hover:underline disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete listing"}
    </button>
  );
}
