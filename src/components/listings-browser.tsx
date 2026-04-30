"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { HomeMap, type HomeMapProps } from "@/components/home-map";
import { ListingListRow } from "@/components/listing-list-row";
import { PriorityEditor } from "@/components/priority-editor";
import {
  fmtTransitDuration,
  googleMapsTransitDirectionsUrl,
} from "@/lib/transit-format";
import { labelChipClasses } from "@/lib/label-color";

export type HomePoiDistance = {
  poiId: string;
  label: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  poiLat: number | null;
  poiLng: number | null;
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
  neighborhood: string | null;
  district: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet: number | null;
  priceUsd: number | null;
  priority: number | null;
  nearestPkRating: number | null;
  availability: string;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  canDelete: boolean;
  createdAt: string;
  poiDistances: HomePoiDistance[];
  labels: HomeLabel[];
};

// SortField is now a free-form string so POI fields can encode their poiId
// (e.g. "poi:abc-123"). Static fields keep their plain literals.
type SortField = string;

type SortDirection = "asc" | "desc";

type SortCriterion = { field: SortField; direction: SortDirection };

const STATIC_SORT_FIELDS: string[] = [
  "priority",
  "createdAt",
  "price",
  "beds",
  "baths",
  "sqft",
  "pkRating",
];

const STATIC_SORT_FIELD_LABEL: Record<string, string> = {
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

const POI_FIELD_PREFIX = "poi:";

function poiSortFieldId(poiId: string): string {
  return `${POI_FIELD_PREFIX}${poiId}`;
}

function poiIdFromSortField(field: string): string | null {
  return field.startsWith(POI_FIELD_PREFIX)
    ? field.slice(POI_FIELD_PREFIX.length)
    : null;
}

function sortFieldLabel(
  field: string,
  poiLabelById: Map<string, string>,
): string {
  const poiId = poiIdFromSortField(field);
  if (poiId) return `🚌 ${poiLabelById.get(poiId) ?? "POI"}`;
  return STATIC_SORT_FIELD_LABEL[field] ?? field;
}

function fieldValue(field: string, l: HomeListingItem): number | null {
  const poiId = poiIdFromSortField(field);
  if (poiId) {
    const d = l.poiDistances.find((x) => x.poiId === poiId);
    return d?.durationSeconds ?? null;
  }
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
    default:
      return null;
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

// Minimum characters before the search query starts narrowing the list. Below
// this we ignore the query so a single typed character doesn't briefly hide
// every listing.
const SEARCH_MIN_CHARS = 2;

function buildSearchHaystack(l: HomeListingItem): string {
  const parts: string[] = [];
  if (l.title) parts.push(l.title);
  if (l.address) parts.push(l.address);
  if (l.neighborhood) parts.push(l.neighborhood);
  for (const lbl of l.labels) parts.push(lbl.name);
  return parts.join(" ").toLowerCase();
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

// "Hyde Park · South Side" when both, or just whichever is set, or null.
function fmtLocale(
  neighborhood: string | null,
  district: string | null,
): string | null {
  const parts = [neighborhood, district].filter(
    (p): p is string => p != null && p.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

export function ListingsBrowser({
  listings,
  viewMode,
  scopeLabels,
  home,
  pois,
}: {
  listings: HomeListingItem[];
  viewMode: "cards" | "list" | "table";
  scopeLabels: HomeLabel[];
  home: HomeMapProps["home"];
  pois: HomeMapProps["pois"];
}) {
  const [sortCriteria, setSortCriteria] =
    useState<SortCriterion[]>(DEFAULT_SORT);
  const [minBeds, setMinBeds] = useState(0);
  const [minBaths, setMinBaths] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minPkRating, setMinPkRating] = useState(0);
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const [activeNeighborhoods, setActiveNeighborhoods] = useState<Set<string>>(
    new Set(),
  );
  const [activeDistricts, setActiveDistricts] = useState<Set<string>>(
    new Set(),
  );
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [autoScroll, setAutoScroll] = useState(true);

  const allNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) {
      if (l.neighborhood) set.add(l.neighborhood);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) {
      if (l.district) set.add(l.district);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const visible = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    const search = trimmed.length >= SEARCH_MIN_CHARS ? trimmed : null;
    const filtered = listings.filter((l) => {
      if (search !== null && !buildSearchHaystack(l).includes(search)) {
        return false;
      }
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
      if (activeNeighborhoods.size > 0) {
        if (!l.neighborhood || !activeNeighborhoods.has(l.neighborhood)) {
          return false;
        }
      }
      if (activeDistricts.size > 0) {
        if (!l.district || !activeDistricts.has(l.district)) {
          return false;
        }
      }
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
    activeNeighborhoods,
    activeDistricts,
    hideUnavailable,
    searchQuery,
  ]);

  function toggleLabel(id: string) {
    setActiveLabels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleNeighborhood(name: string) {
    setActiveNeighborhoods((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleDistrict(name: string) {
    setActiveDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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

  // Static sort fields plus one per POI in scope.
  const allSortFields = useMemo(
    () => [
      ...STATIC_SORT_FIELDS,
      ...(pois ?? []).map((p) => poiSortFieldId(p.id)),
    ],
    [pois],
  );
  const poiLabelById = useMemo(
    () => new Map((pois ?? []).map((p) => [p.id, p.label])),
    [pois],
  );
  const availableSortFields = allSortFields.filter(
    (f) => !sortCriteria.some((c) => c.field === f),
  );

  const visiblePins: HomeMapProps["pins"] = useMemo(
    () =>
      visible
        .filter(
          (l): l is HomeListingItem & { latitude: number; longitude: number } =>
            l.latitude != null && l.longitude != null,
        )
        .map((l) => ({
          id: l.id,
          lat: l.latitude,
          lng: l.longitude,
          label: l.address ?? l.title ?? "Listing",
          href: `/listings/${l.id}`,
          priority: l.priority,
        })),
    [visible],
  );

  function togglePinSelection(id: string) {
    setSelectedListingId((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      <div className="mb-6">
        <HomeMap
          home={home}
          pins={visiblePins}
          pois={pois}
          selectedPinId={selectedListingId}
          onPinSelect={togglePinSelection}
        />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <span
            aria-hidden
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
          >
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search address, name, neighborhood, label… (${SEARCH_MIN_CHARS}+ chars)`}
            className="w-full border border-border bg-input-background text-foreground rounded pl-7 pr-2 py-1.5 text-sm placeholder:text-muted-foreground"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
        <SortBuilder
          criteria={sortCriteria}
          available={availableSortFields}
          poiLabelById={poiLabelById}
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
          label="Min School Grade"
          options={RATING_OPTIONS}
          active={minPkRating}
          onChange={setMinPkRating}
          allowCustom
          customMax={10}
        />
        {scopeLabels.length > 0 ? (
          <LabelFilterGroup
            labels={scopeLabels}
            active={activeLabels}
            onToggle={toggleLabel}
          />
        ) : null}
        {allNeighborhoods.length > 0 ? (
          <TextFilterGroup
            label="Neighborhood"
            values={allNeighborhoods}
            active={activeNeighborhoods}
            onToggle={toggleNeighborhood}
          />
        ) : null}
        {allDistricts.length > 0 ? (
          <TextFilterGroup
            label="District"
            values={allDistricts}
            active={activeDistricts}
            onToggle={toggleDistrict}
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
        <button
          type="button"
          onClick={() => setAutoScroll((v) => !v)}
          aria-pressed={autoScroll}
          title="When on, clicking a pin scrolls the matching listing into view"
          className={`px-2 py-0.5 rounded border transition-colors ${
            autoScroll
              ? "bg-primary/15 border-primary text-foreground"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          Scroll to pin
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
        <CardsView
          listings={visible}
          selectedListingId={selectedListingId}
          autoScroll={autoScroll}
        />
      ) : viewMode === "table" ? (
        <TableView
          listings={visible}
          selectedListingId={selectedListingId}
          autoScroll={autoScroll}
        />
      ) : (
        <ListView
          listings={visible}
          selectedListingId={selectedListingId}
          autoScroll={autoScroll}
        />
      )}
    </div>
  );
}

function SortBuilder({
  criteria,
  available,
  poiLabelById,
  onAdd,
  onRemove,
  onToggleDirection,
  onMove,
}: {
  criteria: SortCriterion[];
  available: SortField[];
  poiLabelById: Map<string, string>;
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
          label={sortFieldLabel(c.field, poiLabelById)}
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
              {sortFieldLabel(f, poiLabelById)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function SortChip({
  criterion,
  label,
  isFirst,
  isLast,
  onToggleDirection,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  criterion: SortCriterion;
  label: string;
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
        {label} {criterion.direction === "asc" ? "↑" : "↓"}
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

function TextFilterGroup({
  label,
  values,
  active,
  onToggle,
}: {
  label: string;
  values: string[];
  active: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => {
          const on = active.has(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              aria-pressed={on}
              className={`px-2 py-0.5 rounded border text-xs transition-opacity ${
                on
                  ? "bg-primary/15 border-primary text-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {v}
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

// Shared: when `selectedId` changes and `enabled` is true, scroll the row
// matching `data-listing-id={selectedId}` into view. Returns a ref to attach
// to the scroll container.
function useScrollToSelected<T extends HTMLElement>(
  selectedId: string | null,
  enabled: boolean,
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!enabled || !selectedId) return;
    const container = ref.current;
    if (!container) return;
    const el = container.querySelector(
      `[data-listing-id="${CSS.escape(selectedId)}"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedId, enabled]);
  return ref;
}

function highlightRingClass(isSelected: boolean): string {
  return isSelected
    ? "ring-2 ring-primary ring-offset-2 bg-primary/20"
    : "";
}

function CardsView({
  listings,
  selectedListingId,
  autoScroll,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
}) {
  const ref = useScrollToSelected<HTMLUListElement>(
    selectedListingId,
    autoScroll,
  );
  return (
    <ul
      ref={ref}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {listings.map((l) => (
        <li
          key={l.id}
          data-listing-id={l.id}
          className={`rounded-lg overflow-hidden border border-border bg-muted hover:opacity-95 transition relative ${highlightRingClass(
            selectedListingId === l.id,
          )}`}
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
              {fmtLocale(l.neighborhood, l.district) ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {fmtLocale(l.neighborhood, l.district)}
                </p>
              ) : null}
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
                  {l.poiDistances.map((d) => {
                    const url = googleMapsTransitDirectionsUrl(
                      { lat: l.latitude, lng: l.longitude },
                      { lat: d.poiLat, lng: d.poiLng },
                    );
                    const text = `🚌 ${d.label}: ${
                      fmtTransitDuration(d.durationSeconds) ?? "—"
                    }`;
                    if (!url) return <span key={d.poiId}>{text}</span>;
                    return (
                      <button
                        key={d.poiId}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(
                            url,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                        className="hover:underline hover:text-foreground"
                        title="Open transit directions in Google Maps"
                      >
                        {text}
                      </button>
                    );
                  })}
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
            {l.canDelete ? (
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

function ListView({
  listings,
  selectedListingId,
  autoScroll,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
}) {
  const ref = useScrollToSelected<HTMLUListElement>(
    selectedListingId,
    autoScroll,
  );
  return (
    <ul
      ref={ref}
      className="border border-border rounded divide-y divide-border"
    >
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
          canDelete={l.canDelete}
          poiDistances={l.poiDistances}
          labels={l.labels}
          priority={l.priority}
          availability={l.availability}
          neighborhood={l.neighborhood}
          district={l.district}
          listingLat={l.latitude}
          listingLng={l.longitude}
          selected={selectedListingId === l.id}
        />
      ))}
    </ul>
  );
}

function TableView({
  listings,
  selectedListingId,
  autoScroll,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
}) {
  const ref = useScrollToSelected<HTMLDivElement>(
    selectedListingId,
    autoScroll,
  );
  return (
    <div
      ref={ref}
      className="border border-border rounded overflow-x-auto"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">P</th>
            <th className="px-3 py-2 text-left font-medium">Photo</th>
            <th className="px-3 py-2 text-left font-medium">Address</th>
            <th className="px-3 py-2 text-left font-medium">Neighborhood</th>
            <th className="px-3 py-2 text-left font-medium">District</th>
            <th className="px-3 py-2 text-right font-medium">BR</th>
            <th className="px-3 py-2 text-right font-medium">BA</th>
            <th className="px-3 py-2 text-right font-medium">Sqft</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">PK</th>
            <th className="px-3 py-2 text-left font-medium">Transit</th>
            <th className="px-3 py-2 text-left font-medium">Labels</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {listings.map((l) => (
            <TableRow
              key={l.id}
              listing={l}
              selected={selectedListingId === l.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({
  listing: l,
  selected,
}: {
  listing: HomeListingItem;
  selected: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const beds = asNum(l.bedrooms);
  const baths = asNum(l.bathrooms);
  return (
    <tr
      data-listing-id={l.id}
      className={`hover:bg-muted/40 transition-colors align-top ${
        selected
          ? "bg-primary/25 outline outline-2 outline-primary"
          : ""
      }`}
    >
      <td className="px-3 py-2 whitespace-nowrap">
        <PriorityEditor
          key={`pri-${l.id}-${l.priority ?? "null"}`}
          listingId={l.id}
          current={l.priority}
        />
      </td>
      <td className="px-3 py-2">
        {l.coverUrl ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block hover:opacity-80 transition-opacity"
            title="Show photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.coverUrl}
              alt="Show photo"
              className="w-16 h-12 object-cover rounded"
              loading="lazy"
            />
          </button>
        ) : (
          <div className="w-16 h-12 rounded bg-muted" />
        )}
      </td>
      <td className="px-3 py-2 min-w-[260px] max-w-[360px]">
        <Link
          href={`/listings/${l.id}`}
          className="font-medium hover:underline block line-clamp-2"
          title={l.address ?? l.title ?? "Unknown address"}
        >
          {l.address ?? l.title ?? "Unknown address"}
        </Link>
      </td>
      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
        {l.neighborhood ?? "—"}
      </td>
      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
        {l.district ?? "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {beds != null ? beds : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {baths != null ? baths : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {l.squareFeet != null ? l.squareFeet.toLocaleString("en-US") : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">
        {l.priceUsd != null ? `$${l.priceUsd.toLocaleString("en-US")}` : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {l.nearestPkRating != null ? `${l.nearestPkRating}/10` : "—"}
      </td>
      <td className="px-3 py-2">
        {l.poiDistances.length > 0 ? (
          <div className="flex flex-col gap-0.5 text-xs">
            {l.poiDistances.map((d) => {
              const url = googleMapsTransitDirectionsUrl(
                { lat: l.latitude, lng: l.longitude },
                { lat: d.poiLat, lng: d.poiLng },
              );
              const text = `🚌 ${d.label}: ${
                fmtTransitDuration(d.durationSeconds) ?? "—"
              }`;
              return url ? (
                <a
                  key={d.poiId}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-foreground whitespace-nowrap"
                  title="Open transit directions in Google Maps"
                >
                  {text}
                </a>
              ) : (
                <span key={d.poiId} className="whitespace-nowrap">
                  {text}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {l.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {l.labels.map((lbl) => (
              <span
                key={lbl.id}
                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${labelChipClasses(lbl.color)}`}
              >
                {lbl.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <UnavailableBadge availability={l.availability} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-1">
          {l.canDelete ? (
            <DeleteListingButton
              listingId={l.id}
              label="Delete"
              className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
            />
          ) : null}
        </div>
      </td>
      {l.coverUrl ? (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: l.coverUrl, alt: l.address ?? "Listing" }]}
          carousel={{ finite: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
        />
      ) : null}
    </tr>
  );
}

function ThresholdGroup({
  label,
  options,
  active,
  onChange,
  allowCustom = false,
  customMax,
}: {
  label: string;
  options: ReadonlyArray<number>;
  active: number;
  onChange: (v: number) => void;
  allowCustom?: boolean;
  customMax?: number;
}) {
  const inputValue = active === 0 ? "" : String(active);
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
      {allowCustom ? (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={customMax}
          step={1}
          value={inputValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(0);
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            const truncated = Math.max(0, Math.trunc(n));
            const clamped =
              customMax != null ? Math.min(truncated, customMax) : truncated;
            onChange(clamped);
          }}
          placeholder="Custom"
          className="w-16 border border-border bg-input-background text-foreground rounded px-1 py-0.5 text-xs"
        />
      ) : null}
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
  const inputValue = value == null ? "" : String(value);
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
      <label className="flex items-center gap-1">
        <span className="text-muted-foreground">$</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={50}
          value={inputValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            onChange(Number.isFinite(n) && n > 0 ? Math.trunc(n) : null);
          }}
          placeholder="Custom"
          className="w-20 border border-border bg-input-background text-foreground rounded px-1 py-0.5 text-xs"
        />
      </label>
    </div>
  );
}
