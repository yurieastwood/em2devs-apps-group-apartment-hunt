"use client";

import { useTransition } from "react";
import { deleteCommentAction } from "./actions";

export function DeleteCommentButton({
  commentId,
  listingId,
}: {
  commentId: string;
  listingId: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("Delete this comment?")) return;
    startTransition(() => deleteCommentAction(commentId, listingId));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
