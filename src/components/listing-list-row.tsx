"use client";

import { useState } from "react";
import Link from "next/link";

export type ListingListRowProps = {
  listingId: string;
  address: string;
  bedrooms: string | null;
  bathrooms: string | null;
  priceUsd: number | null;
  coverUrl: string | null;
};

export function ListingListRow({
  listingId,
  address,
  bedrooms,
  bathrooms,
  priceUsd,
  coverUrl,
}: ListingListRowProps) {
  const [show, setShow] = useState(false);

  return (
    <li>
      <div className="flex items-center gap-4 px-3 py-2 hover:bg-muted/40 transition-colors">
        <div className="flex-1 min-w-0">
          <Link
            href={`/listings/${listingId}`}
            className="font-medium hover:underline block truncate"
          >
            {address}
          </Link>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {bedrooms ? <span>{bedrooms} BR</span> : null}
            {bathrooms ? <span>{bathrooms} BA</span> : null}
            {priceUsd ? (
              <span className="font-semibold text-foreground">
                ${priceUsd.toLocaleString("en-US")}/mo
              </span>
            ) : null}
          </p>
        </div>
        {coverUrl ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-expanded={show}
            className="text-sm text-primary hover:underline shrink-0"
          >
            {show ? "Hide photo" : "Show photo"}
          </button>
        ) : null}
      </div>
      {show && coverUrl ? (
        <div className="px-3 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={address}
            className="w-full max-w-sm rounded border border-border"
            loading="lazy"
          />
        </div>
      ) : null}
    </li>
  );
}
