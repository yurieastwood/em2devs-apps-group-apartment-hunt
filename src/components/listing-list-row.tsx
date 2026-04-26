"use client";

import { useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "./delete-listing-button";

export type ListingListRowProps = {
  listingId: string;
  address: string;
  bedrooms: string | null;
  bathrooms: string | null;
  priceUsd: number | null;
  bestPkRating?: number | null;
  coverUrl: string | null;
  isOwner?: boolean;
};

export function ListingListRow({
  listingId,
  address,
  bedrooms,
  bathrooms,
  priceUsd,
  bestPkRating,
  coverUrl,
  isOwner,
}: ListingListRowProps) {
  const [open, setOpen] = useState(false);

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
            {bestPkRating != null ? (
              <span title="Best nearby PK school rating">
                🏫 {bestPkRating}/10
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {coverUrl ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              Show photo
            </button>
          ) : null}
          {isOwner ? (
            <DeleteListingButton
              listingId={listingId}
              label="Delete"
              className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
            />
          ) : null}
        </div>
      </div>
      {coverUrl ? (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={[{ src: coverUrl, alt: address }]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      ) : null}
    </li>
  );
}
