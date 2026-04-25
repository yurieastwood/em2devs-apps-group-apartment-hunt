"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addCommentAction, type CommentState } from "./actions";

const initial: CommentState = { kind: "idle" };

export function CommentForm({ listingId }: { listingId: string }) {
  const action = addCommentAction.bind(null, listingId);
  const [state, formAction] = useActionState<CommentState, FormData>(
    action,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.kind === "posted") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <textarea
        name="body"
        required
        rows={3}
        maxLength={5000}
        placeholder="Add a comment for the family…"
        className="border border-border bg-input-background text-foreground rounded p-2 text-sm placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.kind === "error" ? (
          <span className="text-destructive text-sm">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground rounded px-4 py-2 text-sm"
    >
      {pending ? "Posting…" : "Post comment"}
    </button>
  );
}
