"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { ListingListRow } from "@/components/listing-list-row";

export type HomeListingItem = {
  id: string;
  title: string | null;
  address: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet: number | null;
  priceUsd: number | null;
  nearestPkRating: number | null;
  coverUrl: string | null;
  isOwner: boolean;
  createdAt: string;
};

type SortOption =
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "beds-desc"
  | "baths-desc"
  | "rating-desc";

const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
const BATHS_OPTIONS = [0, 1, 2, 3] as const;
const RATING_OPTIONS = [0, 4, 7, 9] as const;
const PRICE_OPTIONS: ReadonlyArray<{ label: string; value: number | null }> = [
  { label: "Any", value: null },
  { label: "<$2k", value: 2000 },
  { label: "<$3k", value: 3000 },
  { label: "<$4k", value: 4000 },
  { label: "<$5k", value: 5000 },
];

function asNum(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

export function ListingsBrowser({
  listings,
  viewMode,
}: {
  listings: HomeListingItem[];
  viewMode: "cards" | "list";
}) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [minBeds, setMinBeds] = useState(0);
  const [minBaths, setMinBaths] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minPkRating, setMinPkRating] = useState(0);

  const visible = useMemo(() => {
    const filtered = listings.filter((l) => {
      if (minBeds > 0) {
        const b = asNum(l.bedrooms);
        if (b == null || b < minBeds) return false;
      }
      if (minBaths > 0) {
        const b = asNum(l.bathrooms);
        if (b == null || b < minBaths) return false;
      }
      if (maxPrice != null) {
        if (l.priceUsd == null || l.priceUsd > maxPrice) return false;
      }
      if (minPkRating > 0) {
        if (l.nearestPkRating == null || l.nearestPkRating < minPkRating) {
          return false;
        }
      }
      return true;
    });

    const sorter: Record<
      SortOption,
      (a: HomeListingItem, b: HomeListingItem) => number
    > = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      "price-asc": (a, b) =>
        (a.priceUsd ?? Number.POSITIVE_INFINITY) -
        (b.priceUsd ?? Number.POSITIVE_INFINITY),
      "price-desc": (a, b) => (b.priceUsd ?? -1) - (a.priceUsd ?? -1),
      "beds-desc": (a, b) =>
        (asNum(b.bedrooms) ?? -1) - (asNum(a.bedrooms) ?? -1),
      "baths-desc": (a, b) =>
        (asNum(b.bathrooms) ?? -1) - (asNum(a.bathrooms) ?? -1),
      "rating-desc": (a, b) => (b.nearestPkRating ?? -1) - (a.nearestPkRating ?? -1),
    };
    return [...filtered].sort(sorter[sort]);
  }, [listings, sort, minBeds, minBaths, maxPrice, minPkRating]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="border border-border bg-input-background text-foreground rounded px-2 py-1"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price-asc">Price (low → high)</option>
            <option value="price-desc">Price (high → low)</option>
            <option value="beds-desc">Most bedrooms</option>
            <option value="baths-desc">Most bathrooms</option>
            <option value="rating-desc">Nearest PK rating (high → low)</option>
          </select>
        </label>
        <ThresholdGroup
          label="Beds"
          options={BEDS_OPTIONS}
          active={minBeds}
          onChange={setMinBeds}
        />
        <ThresholdGroup
          label="Baths"
          options={BATHS_OPTIONS}
          active={minBaths}
          onChange={setMinBaths}
        />
        <PriceGroup value={maxPrice} onChange={setMaxPrice} />
        <ThresholdGroup
          label="School"
          options={RATING_OPTIONS}
          active={minPkRating}
          onChange={setMinPkRating}
        />
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {visible.length === listings.length
          ? `${listings.length} listing${listings.length === 1 ? "" : "s"}`
          : `${visible.length} of ${listings.length} listing${
              listings.length === 1 ? "" : "s"
            }`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">No listings match these filters.</p>
      ) : viewMode === "cards" ? (
        <CardsView listings={visible} />
      ) : (
        <ListView listings={visible} />
      )}
    </div>
  );
}

function CardsView({ listings }: { listings: HomeListingItem[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((l) => (
        <li
          key={l.id}
          className="rounded-lg overflow-hidden border border-border bg-muted hover:opacity-95 transition relative"
        >
          <Link href={`/listings/${l.id}`} className="block">
            <div className="aspect-[4/3] bg-muted">
              {l.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.coverUrl}
                  alt={l.address ?? "Listing"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  No photo
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="font-medium line-clamp-1">
                {l.address ?? "Unknown address"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                {l.bedrooms ? <span>{l.bedrooms} BR</span> : null}
                {l.bathrooms ? <span>{l.bathrooms} BA</span> : null}
                {l.squareFeet ? (
                  <span>{l.squareFeet.toLocaleString("en-US")} sqft</span>
                ) : null}
                {l.priceUsd ? (
                  <span className="font-semibold text-foreground">
                    {fmtPrice(l.priceUsd)}
                  </span>
                ) : null}
                {l.nearestPkRating != null ? (
                  <span title="Nearest PK school rating">
                    🏫 {l.nearestPkRating}/10
                  </span>
                ) : null}
              </p>
            </div>
          </Link>
          {l.isOwner ? (
            <div className="px-4 pb-3">
              <DeleteListingButton
                listingId={l.id}
                label="Delete"
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ListView({ listings }: { listings: HomeListingItem[] }) {
  return (
    <ul className="border border-border rounded divide-y divide-border">
      {listings.map((l) => (
        <ListingListRow
          key={l.id}
          listingId={l.id}
          address={l.address ?? l.title ?? "Unknown address"}
          bedrooms={l.bedrooms}
          bathrooms={l.bathrooms}
          squareFeet={l.squareFeet}
          priceUsd={l.priceUsd}
          nearestPkRating={l.nearestPkRating}
          coverUrl={l.coverUrl}
          isOwner={l.isOwner}
        />
      ))}
    </ul>
  );
}

function ThresholdGroup({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<number>;
  active: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active === opt}
            className={`px-2 py-0.5 rounded border transition-colors ${
              active === opt
                ? "bg-primary/15 border-primary text-foreground"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {opt === 0 ? "Any" : `${opt}+`}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceGroup({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Max price</span>
      <div className="flex gap-1">
        {PRICE_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              className={`px-2 py-0.5 rounded border transition-colors ${
                isActive
                  ? "bg-primary/15 border-primary text-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
