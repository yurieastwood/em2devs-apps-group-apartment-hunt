"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListingAction } from "@/app/listings/[id]/actions";

export function DeleteListingButton({
  listingId,
  navigateTo,
  className,
  label = "Delete listing",
  confirmText = "Delete this listing? Photos will be removed from storage. This can't be undone.",
}: {
  listingId: string;
  navigateTo?: string;
  className?: string;
  label?: string;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      await deleteListingAction(listingId);
      if (navigateTo) router.push(navigateTo);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        className ??
        "text-sm text-destructive hover:underline disabled:opacity-60"
      }
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
