"use client";

import { useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "./delete-listing-button";
import { PriorityEditor } from "./priority-editor";
import { ContactStatusEditor } from "./contact-status-editor";
import { WhatsAppShareLink } from "./whatsapp-share-link";
import {
  fmtTransitDuration,
  googleMapsTransitDirectionsUrl,
} from "@/lib/transit-format";
import { labelChipClasses } from "@/lib/label-color";
import { AvailabilityBadge } from "./availability-badge";

export type ListingListRowPoi = {
  poiId: string;
  label: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  poiLat: number | null;
  poiLng: number | null;
};

export type ListingListRowLabel = {
  id: string;
  name: string;
  color: string | null;
};

export type ListingListRowProps = {
  listingId: string;
  title: string | null;
  address: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet?: number | null;
  priceUsd: number | null;
  nearestPkRating?: number | null;
  coverUrl: string | null;
  canDelete?: boolean;
  poiDistances?: ListingListRowPoi[];
  labels?: ListingListRowLabel[];
  priority?: number | null;
  availability?: string;
  contactStatus?: string | null;
  commentCount?: number;
  possibleDuplicate?: boolean;
  whatsappUrl?: string;
  neighborhood?: string | null;
  district?: string | null;
  safetyScore?: number | null;
  listingLat?: number | null;
  listingLng?: number | null;
  selected?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
};

// True when a click landed on (or inside) an interactive control, so the
// row-level click-to-select handler can ignore it and let the control act.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, label") != null
  );
}

export function ListingListRow({
  listingId,
  title,
  address,
  bedrooms,
  bathrooms,
  squareFeet,
  priceUsd,
  nearestPkRating,
  coverUrl,
  canDelete,
  poiDistances,
  labels,
  priority,
  availability,
  contactStatus,
  commentCount,
  possibleDuplicate,
  whatsappUrl,
  neighborhood,
  district,
  safetyScore,
  listingLat,
  listingLng,
  selected,
  checked,
  onToggleCheck,
}: ListingListRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <li data-listing-id={listingId}>
      <div
        onClick={(e) => {
          if (onToggleCheck && !isInteractiveTarget(e.target)) onToggleCheck();
        }}
        className={`flex items-center gap-4 px-3 py-2 transition-colors ${
          checked
            ? "bg-destructive/15 outline outline-1 outline-destructive/50 rounded"
            : selected
              ? "ring-2 ring-primary ring-offset-2 rounded bg-primary/20"
              : "hover:bg-muted/40"
        } ${onToggleCheck ? "cursor-pointer" : ""}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <Link
              href={`/listings/${listingId}`}
              className="block hover:underline min-w-0 flex-1"
            >
              <span className="font-medium block truncate">
                {title ?? address ?? "Unknown address"}
              </span>
              {title && address && title !== address ? (
                <span className="text-sm text-muted-foreground block truncate">
                  {address}
                </span>
              ) : null}
            </Link>
            {possibleDuplicate ? (
              <span
                title="Possible duplicate of another listing"
                className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium uppercase tracking-wide shrink-0"
              >
                Dup?
              </span>
            ) : null}
            {availability === "unavailable" ? (
              <AvailabilityBadge availability={availability} size="compact" />
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {neighborhood || district ? (
              <span>
                📍 {[neighborhood, district].filter(Boolean).join(" · ")}
              </span>
            ) : null}
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
            {safetyScore != null ? (
              <span
                title={`Safety: ${safetyScore}/100. Compared to your home — 50 = same as home, higher = safer.`}
              >
                🛡 {safetyScore}
              </span>
            ) : null}
            {commentCount != null && commentCount > 0 ? (
              <span title={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}>
                💬 {commentCount}
              </span>
            ) : null}
          </p>
          {poiDistances && poiDistances.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {poiDistances.map((d) => {
                const url = googleMapsTransitDirectionsUrl(
                  { lat: listingLat ?? null, lng: listingLng ?? null },
                  { lat: d.poiLat, lng: d.poiLng },
                );
                const text = `🚌 ${d.label}: ${
                  fmtTransitDuration(d.durationSeconds) ?? "—"
                }`;
                if (!url) return <span key={d.poiId}>{text}</span>;
                return (
                  <a
                    key={d.poiId}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-foreground"
                    title="Open transit directions in Google Maps"
                  >
                    {text}
                  </a>
                );
              })}
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
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 max-w-[180px]">
          <PriorityEditor
            key={`pri-${listingId}-${priority ?? "null"}`}
            listingId={listingId}
            current={priority ?? null}
          />
          <ContactStatusEditor
            key={`cs-${listingId}-${contactStatus ?? "null"}`}
            listingId={listingId}
            current={contactStatus ?? null}
          />
          {whatsappUrl ? <WhatsAppShareLink url={whatsappUrl} /> : null}
          {coverUrl ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Show photo"
              aria-label="Show photo"
              className="inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6Zm3 13.5 6.879-6.879a1.5 1.5 0 0 1 2.121 0l3.348 3.348a1.5 1.5 0 0 0 2.121 0l.781-.781V6a.75.75 0 0 0-.75-.75H3.75A.75.75 0 0 0 3 6v12c0 .414.336.75.75.75h.75ZM15 9a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
                />
              </svg>
            </button>
          ) : null}
          {canDelete ? (
            <DeleteListingButton
              listingId={listingId}
              label="Delete"
              className="text-muted-foreground hover:text-destructive disabled:opacity-60"
            />
          ) : null}
        </div>
      </div>
      {coverUrl ? (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={[{ src: coverUrl, alt: title ?? address ?? "" }]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      ) : null}
    </li>
  );
}
