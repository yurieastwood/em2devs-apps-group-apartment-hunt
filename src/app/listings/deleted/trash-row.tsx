"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  permanentlyDeleteListingAction,
  restoreListingAction,
} from "@/lib/listings/trash-actions";

type Props = {
  listingId: string;
  title: string;
  address: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  priceUsd: number | null;
  neighborhood: string | null;
  coverUrl: string | null;
  deletedAt: string;
};

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrashRow({
  listingId,
  title,
  address,
  bedrooms,
  bathrooms,
  priceUsd,
  neighborhood,
  coverUrl,
  deletedAt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreListingAction(listingId);
      if (!result.ok) setError(result.reason);
    });
  }

  function onPurge() {
    if (
      !window.confirm(
        "Permanently delete this listing? Photos and audit history will be removed from storage. This can't be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await permanentlyDeleteListingAction(listingId);
      if (!result.ok) setError(result.reason);
    });
  }

  return (
    <li className="flex items-start gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
      <div className="w-20 h-16 bg-muted rounded shrink-0 overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/listings/${listingId}`}
          className="font-medium hover:underline block truncate"
        >
          {title}
        </Link>
        {address && address !== title ? (
          <p className="text-xs text-muted-foreground truncate">{address}</p>
        ) : null}
        <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
          {neighborhood ? <span>📍 {neighborhood}</span> : null}
          {bedrooms ? <span>{bedrooms} BR</span> : null}
          {bathrooms ? <span>{bathrooms} BA</span> : null}
          {priceUsd ? (
            <span className="font-semibold text-foreground">
              {fmtPrice(priceUsd)}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Deleted {fmtWhen(deletedAt)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          disabled={pending}
          className="text-sm text-primary hover:underline disabled:opacity-60"
        >
          {pending ? "…" : "Restore"}
        </button>
        <button
          type="button"
          onClick={onPurge}
          disabled={pending}
          className="text-xs text-destructive hover:underline disabled:opacity-60"
        >
          Delete forever
        </button>
        {error ? (
          <span className="text-xs text-destructive max-w-32 text-right">
            {error}
          </span>
        ) : null}
      </div>
    </li>
  );
}
