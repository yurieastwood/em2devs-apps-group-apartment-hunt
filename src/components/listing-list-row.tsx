"use client";

import { useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "./delete-listing-button";
import { PriorityEditor } from "./priority-editor";
import { fmtTransitDuration } from "@/lib/transit-format";
import { labelChipClasses } from "@/lib/label-color";

export type ListingListRowPoi = {
  poiId: string;
  label: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

export type ListingListRowLabel = {
  id: string;
  name: string;
  color: string | null;
};

export type ListingListRowProps = {
  listingId: string;
  address: string;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet?: number | null;
  priceUsd: number | null;
  nearestPkRating?: number | null;
  coverUrl: string | null;
  isOwner?: boolean;
  poiDistances?: ListingListRowPoi[];
  labels?: ListingListRowLabel[];
  priority?: number | null;
  availability?: string;
};

export function ListingListRow({
  listingId,
  address,
  bedrooms,
  bathrooms,
  squareFeet,
  priceUsd,
  nearestPkRating,
  coverUrl,
  isOwner,
  poiDistances,
  labels,
  priority,
  availability,
}: ListingListRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <div className="flex items-center gap-4 px-3 py-2 hover:bg-muted/40 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/listings/${listingId}`}
              className="font-medium hover:underline block truncate"
            >
              {address}
            </Link>
            {availability === "unavailable" ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30 text-[10px] font-medium uppercase tracking-wide shrink-0">
                Unavailable
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {bedrooms ? <span>{bedrooms} BR</span> : null}
            {bathrooms ? <span>{bathrooms} BA</span> : null}
            {squareFeet ? (
              <span>{squareFeet.toLocaleString("en-US")} sqft</span>
            ) : null}
            {priceUsd ? (
              <span className="font-semibold text-foreground">
                ${priceUsd.toLocaleString("en-US")}/mo
              </span>
            ) : null}
            {nearestPkRating != null ? (
              <span title="Nearest PK school rating">
                🏫 {nearestPkRating}/10
              </span>
            ) : null}
          </p>
          {poiDistances && poiDistances.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {poiDistances.map((d) => (
                <span key={d.poiId}>
                  🚌 {d.label}: {fmtTransitDuration(d.durationSeconds) ?? "—"}
                </span>
              ))}
            </p>
          ) : null}
          {labels && labels.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {labels.map((l) => (
                <span
                  key={l.id}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${labelChipClasses(l.color)}`}
                >
                  {l.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PriorityEditor
            key={`pri-${listingId}-${priority ?? "null"}`}
            listingId={listingId}
            current={priority ?? null}
          />
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
