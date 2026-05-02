"use client";

import { useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "./delete-listing-button";
import { PriorityEditor } from "./priority-editor";
import {
  fmtTransitDuration,
  googleMapsTransitDirectionsUrl,
} from "@/lib/transit-format";
import { labelChipClasses } from "@/lib/label-color";

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
  neighborhood?: string | null;
  district?: string | null;
  safetyScore?: number | null;
  listingLat?: number | null;
  listingLng?: number | null;
  selected?: boolean;
};

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
  neighborhood,
  district,
  safetyScore,
  listingLat,
  listingLng,
  selected,
}: ListingListRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <li
      data-listing-id={listingId}
      className={
        selected
          ? "ring-2 ring-primary ring-offset-2 rounded bg-primary/20"
          : ""
      }
    >
      <div className="flex items-center gap-4 px-3 py-2 hover:bg-muted/40 transition-colors">
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
            {availability === "unavailable" ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30 text-[10px] font-medium uppercase tracking-wide shrink-0">
                Unavailable
              </span>
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
                title={`Safety: ${safetyScore}/100. Percentile rank within your library — 100 = safest, 0 = least safe.`}
              >
                🛡 {safetyScore}
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
          {canDelete ? (
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
          slides={[{ src: coverUrl, alt: title ?? address ?? "" }]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      ) : null}
    </li>
  );
}
