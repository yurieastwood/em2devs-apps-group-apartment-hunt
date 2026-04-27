"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { ListingListRow } from "@/components/listing-list-row";
import { PriorityEditor } from "@/components/priority-editor";
import { fmtTransitDuration } from "@/lib/transit-format";
import { labelChipClasses } from "@/lib/label-color";

export type HomePoiDistance = {
  poiId: string;
  label: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

export type HomeLabel = {
  id: string;
  name: string;
  color: string | null;
};

export type HomeListingItem = {
  id: string;
  title: string | null;
  address: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet: number | null;
  priceUsd: number | null;
  priority: number | null;
  nearestPkRating: number | null;
  availability: string;
  coverUrl: string | null;
  isOwner: boolean;
  createdAt: string;
  poiDistances: HomePoiDistance[];
  labels: HomeLabel[];
};

type SortField =
  | "priority"
  | "createdAt"
  | "price"
  | "beds"
  | "baths"
  | "sqft"
  | "pkRating";

type SortDirection = "asc" | "desc";

type SortCriterion = { field: SortField; direction: SortDirection };

const ALL_SORT_FIELDS: SortField[] = [
  "priority",
  "createdAt",
  "price",
  "beds",
  "baths",
  "sqft",
  "pkRating",
];

const SORT_FIELD_LABEL: Record<SortField, string> = {
  priority: "Priority",
  createdAt: "Date added",
  price: "Price",
  beds: "Bedrooms",
  baths: "Bathrooms",
  sqft: "Sq ft",
  pkRating: "PK rating",
};

const DEFAULT_SORT: SortCriterion[] = [
  { field: "priority", direction: "asc" },
];

function fieldValue(field: SortField, l: HomeListingItem): number | null {
  switch (field) {
    case "priority":
      return l.priority;
    case "createdAt":
      return new Date(l.createdAt).getTime();
    case "price":
      return l.priceUsd;
    case "beds":
      return asNum(l.bedrooms);
    case "baths":
      return asNum(l.bathrooms);
    case "sqft":
      return l.squareFeet;
    case "pkRating":
      return l.nearestPkRating;
  }
}

function compareCriterion(
  c: SortCriterion,
  a: HomeListingItem,
  b: HomeListingItem,
): number {
  const va = fieldValue(c.field, a);
  const vb = fieldValue(c.field, b);
  // Nulls sort last regardless of direction.
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return c.direction === "asc" ? va - vb : vb - va;
}

function compareWithCriteria(
  criteria: SortCriterion[],
  a: HomeListingItem,
  b: HomeListingItem,
): number {
  for (const c of criteria) {
    const r = compareCriterion(c, a, b);
    if (r !== 0) return r;
  }
  return 0;
}

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
  scopeLabels,
}: {
  listings: HomeListingItem[];
  viewMode: "cards" | "list";
  scopeLabels: HomeLabel[];
}) {
  const [sortCriteria, setSortCriteria] =
    useState<SortCriterion[]>(DEFAULT_SORT);
  const [minBeds, setMinBeds] = useState(0);
  const [minBaths, setMinBaths] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minPkRating, setMinPkRating] = useState(0);
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const [hideUnavailable, setHideUnavailable] = useState(false);

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
      if (activeLabels.size > 0) {
        const hit = l.labels.some((lbl) => activeLabels.has(lbl.id));
        if (!hit) return false;
      }
      if (hideUnavailable && l.availability === "unavailable") return false;
      return true;
    });

    const effectiveCriteria =
      sortCriteria.length > 0 ? sortCriteria : DEFAULT_SORT;
    return [...filtered].sort((a, b) =>
      compareWithCriteria(effectiveCriteria, a, b),
    );
  }, [
    listings,
    sortCriteria,
    minBeds,
    minBaths,
    maxPrice,
    minPkRating,
    activeLabels,
    hideUnavailable,
  ]);

  function toggleLabel(id: string) {
    setActiveLabels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSortField(field: SortField) {
    setSortCriteria((prev) => [...prev, { field, direction: "asc" }]);
  }

  function removeSortAt(index: number) {
    setSortCriteria((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : DEFAULT_SORT;
    });
  }

  function toggleDirectionAt(index: number) {
    setSortCriteria((prev) =>
      prev.map((c, i) =>
        i === index
          ? { ...c, direction: c.direction === "asc" ? "desc" : "asc" }
          : c,
      ),
    );
  }

  function moveSortAt(index: number, delta: -1 | 1) {
    setSortCriteria((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const availableSortFields = ALL_SORT_FIELDS.filter(
    (f) => !sortCriteria.some((c) => c.field === f),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
        <SortBuilder
          criteria={sortCriteria}
          available={availableSortFields}
          onAdd={addSortField}
          onRemove={removeSortAt}
          onToggleDirection={toggleDirectionAt}
          onMove={moveSortAt}
        />
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
        {scopeLabels.length > 0 ? (
          <LabelFilterGroup
            labels={scopeLabels}
            active={activeLabels}
            onToggle={toggleLabel}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setHideUnavailable((v) => !v)}
          aria-pressed={hideUnavailable}
          className={`px-2 py-0.5 rounded border transition-colors ${
            hideUnavailable
              ? "bg-primary/15 border-primary text-foreground"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          Hide unavailable
        </button>
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

function SortBuilder({
  criteria,
  available,
  onAdd,
  onRemove,
  onToggleDirection,
  onMove,
}: {
  criteria: SortCriterion[];
  available: SortField[];
  onAdd: (f: SortField) => void;
  onRemove: (i: number) => void;
  onToggleDirection: (i: number) => void;
  onMove: (i: number, delta: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground">Sort</span>
      {criteria.map((c, i) => (
        <SortChip
          key={`${c.field}-${i}`}
          criterion={c}
          isFirst={i === 0}
          isLast={i === criteria.length - 1}
          onToggleDirection={() => onToggleDirection(i)}
          onRemove={() => onRemove(i)}
          onMoveUp={() => onMove(i, -1)}
          onMoveDown={() => onMove(i, 1)}
        />
      ))}
      {available.length > 0 ? (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onAdd(e.target.value as SortField);
            }
          }}
          className="border border-border bg-input-background text-foreground rounded px-2 py-1"
        >
          <option value="">+ Add field</option>
          {available.map((f) => (
            <option key={f} value={f}>
              {SORT_FIELD_LABEL[f]}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function SortChip({
  criterion,
  isFirst,
  isLast,
  onToggleDirection,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  criterion: SortCriterion;
  isFirst: boolean;
  isLast: boolean;
  onToggleDirection: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary bg-primary/15 text-foreground">
      {!isFirst ? (
        <button
          type="button"
          onClick={onMoveUp}
          aria-label="Move earlier"
          className="opacity-60 hover:opacity-100"
        >
          ‹
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggleDirection}
        className="font-medium"
        title="Toggle direction"
      >
        {SORT_FIELD_LABEL[criterion.field]}{" "}
        {criterion.direction === "asc" ? "↑" : "↓"}
      </button>
      {!isLast ? (
        <button
          type="button"
          onClick={onMoveDown}
          aria-label="Move later"
          className="opacity-60 hover:opacity-100"
        >
          ›
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove sort field"
        className="opacity-60 hover:opacity-100 hover:text-destructive ml-0.5"
      >
        ×
      </button>
    </span>
  );
}

function LabelFilterGroup({
  labels,
  active,
  onToggle,
}: {
  labels: HomeLabel[];
  active: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground">Labels</span>
      <div className="flex flex-wrap gap-1">
        {labels.map((l) => {
          const on = active.has(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onToggle(l.id)}
              aria-pressed={on}
              className={`px-2 py-0.5 rounded-full border text-xs transition-opacity ${labelChipClasses(l.color)} ${
                on ? "ring-2 ring-foreground/40" : "opacity-60 hover:opacity-100"
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnavailableBadge({ availability }: { availability: string }) {
  if (availability !== "unavailable") return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30 text-[10px] font-medium uppercase tracking-wide">
      Unavailable
    </span>
  );
}

function LabelChips({ labels }: { labels: HomeLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {labels.map((l) => (
        <span
          key={l.id}
          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${labelChipClasses(l.color)}`}
        >
          {l.name}
        </span>
      ))}
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
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium line-clamp-1">
                  {l.address ?? "Unknown address"}
                </p>
                <UnavailableBadge availability={l.availability} />
              </div>
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
              {l.poiDistances.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {l.poiDistances.map((d) => (
                    <span key={d.poiId}>
                      🚌 {d.label}:{" "}
                      {fmtTransitDuration(d.durationSeconds) ?? "—"}
                    </span>
                  ))}
                </p>
              ) : null}
              <LabelChips labels={l.labels} />
            </div>
          </Link>
          <div className="px-4 pb-3 flex items-center justify-between gap-3">
            <PriorityEditor
              key={`pri-${l.id}-${l.priority ?? "null"}`}
              listingId={l.id}
              current={l.priority}
            />
            {l.isOwner ? (
              <DeleteListingButton
                listingId={l.id}
                label="Delete"
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
              />
            ) : null}
          </div>
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
          poiDistances={l.poiDistances}
          labels={l.labels}
          priority={l.priority}
          availability={l.availability}
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
