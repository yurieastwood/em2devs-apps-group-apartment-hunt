"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { bulkDeleteListingsAction } from "@/app/listings/[id]/actions";
import { HomeMap, type HomeMapProps } from "@/components/home-map";
import { ListingListRow } from "@/components/listing-list-row";
import { PriorityEditor } from "@/components/priority-editor";
import { ContactStatusEditor } from "@/components/contact-status-editor";
import { WhatsAppShareLink } from "@/components/whatsapp-share-link";
import { buildWhatsAppShareUrl } from "@/lib/listings/whatsapp-share";
import {
  CONTACT_STATUSES,
  contactStatusLabel,
} from "@/lib/listings/contact-status";
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
  safetyScore: number | null;
  availability: string;
  contactStatus: string | null;
  commentCount: number;
  possibleDuplicate: boolean;
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
  "safetyScore",
];

const STATIC_SORT_FIELD_LABEL: Record<string, string> = {
  priority: "Priority",
  createdAt: "Date added",
  price: "Price",
  beds: "Bedrooms",
  baths: "Bathrooms",
  sqft: "Sq ft",
  pkRating: "PK rating",
  safetyScore: "Safety",
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
    case "safetyScore":
      return l.safetyScore;
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
  appBaseUrl,
}: {
  listings: HomeListingItem[];
  viewMode: "cards" | "list" | "table";
  scopeLabels: HomeLabel[];
  home: HomeMapProps["home"];
  pois: HomeMapProps["pois"];
  appBaseUrl: string;
}) {
  const [sortCriteria, setSortCriteria] =
    useState<SortCriterion[]>(DEFAULT_SORT);
  const [minBeds, setMinBeds] = useState(0);
  const [minBaths, setMinBaths] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minPkRating, setMinPkRating] = useState(0);
  const [minSafetyScore, setMinSafetyScore] = useState(0);
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const [activeNeighborhoods, setActiveNeighborhoods] = useState<Set<string>>(
    new Set(),
  );
  const [activeDistricts, setActiveDistricts] = useState<Set<string>>(
    new Set(),
  );
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [activeContactStatuses, setActiveContactStatuses] = useState<
    Set<string>
  >(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [comparing, setComparing] = useState(false);

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
      if (minSafetyScore > 0) {
        if (l.safetyScore == null || l.safetyScore < minSafetyScore) {
          return false;
        }
      }
      if (activeLabels.size > 0) {
        const hit = l.labels.some((lbl) => activeLabels.has(lbl.id));
        if (!hit) return false;
      }
      if (hideUnavailable && l.availability === "unavailable") return false;
      if (activeContactStatuses.size > 0) {
        if (
          !l.contactStatus ||
          !activeContactStatuses.has(l.contactStatus)
        ) {
          return false;
        }
      }
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
    minSafetyScore,
    activeLabels,
    activeNeighborhoods,
    activeDistricts,
    hideUnavailable,
    activeContactStatuses,
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

  function toggleContactStatus(value: string) {
    setActiveContactStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
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

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const count = checkedIds.size;
    if (
      !window.confirm(
        `Move ${count} listing${count === 1 ? "" : "s"} to Trash?`,
      )
    )
      return;
    const ids = Array.from(checkedIds);
    startBulkTransition(async () => {
      await bulkDeleteListingsAction(ids);
      setCheckedIds(new Set());
    });
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
        <ThresholdGroup
          label="Min Safety"
          options={[0, 50, 70, 90] as const}
          active={minSafetyScore}
          onChange={setMinSafetyScore}
          allowCustom
          customMax={100}
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
        <ContactStatusFilterGroup
          active={activeContactStatuses}
          onToggle={toggleContactStatus}
        />
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
          checkedIds={checkedIds}
          onToggleCheck={toggleCheck}
          appBaseUrl={appBaseUrl}
        />
      ) : viewMode === "table" ? (
        <TableView
          listings={visible}
          selectedListingId={selectedListingId}
          autoScroll={autoScroll}
          checkedIds={checkedIds}
          onToggleCheck={toggleCheck}
          appBaseUrl={appBaseUrl}
        />
      ) : (
        <ListView
          listings={visible}
          selectedListingId={selectedListingId}
          autoScroll={autoScroll}
          checkedIds={checkedIds}
          onToggleCheck={toggleCheck}
          appBaseUrl={appBaseUrl}
        />
      )}
      <BulkActionBar
        count={checkedIds.size}
        onDelete={handleBulkDelete}
        onClear={() => setCheckedIds(new Set())}
        onCompare={() => setComparing(true)}
        pending={bulkPending}
      />
      {comparing ? (
        <CompareModal
          items={listings.filter((l) => checkedIds.has(l.id))}
          pois={pois}
          onClose={() => setComparing(false)}
        />
      ) : null}
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

function ContactStatusFilterGroup({
  active,
  onToggle,
}: {
  active: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground">Status</span>
      <div className="flex flex-wrap gap-1">
        {CONTACT_STATUSES.map((s) => {
          const on = active.has(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onToggle(s.value)}
              aria-pressed={on}
              className={`px-2 py-0.5 rounded border text-xs transition-opacity ${
                on
                  ? "bg-primary/15 border-primary text-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommentCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
      title={`${count} comment${count === 1 ? "" : "s"}`}
    >
      💬 {count}
    </span>
  );
}

function safetyClass(score: number): string {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "text-lime-700 dark:text-lime-400";
  if (score >= 40) return "text-amber-700 dark:text-amber-400";
  if (score >= 20) return "text-orange-700 dark:text-orange-400";
  return "text-destructive";
}

function SafetyBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  return (
    <span
      className={`tabular-nums ${safetyClass(score)}`}
      title={`Safety: ${score}/100. Compared to your home address — 50 = same as home, >50 = safer, <50 = less safe. Falls back to library percentile rank when home isn't set. See the detail page for all three lenses.`}
    >
      🛡 {score}
    </span>
  );
}

function DuplicateBadge() {
  return (
    <span
      title="Possible duplicate of another listing"
      className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium uppercase tracking-wide shrink-0"
    >
      Dup?
    </span>
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

// True when a click landed on (or inside) an interactive control, so row-level
// click-to-select handlers can ignore it and let the control do its own thing.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, label") != null
  );
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
  checkedIds,
  onToggleCheck,
  appBaseUrl,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  appBaseUrl: string;
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
                <div className="min-w-0 flex-1">
                  <p className="font-medium line-clamp-1">
                    {l.title ?? l.address ?? "Unknown address"}
                  </p>
                  {l.title && l.address && l.title !== l.address ? (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {l.address}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {l.possibleDuplicate ? <DuplicateBadge /> : null}
                  <UnavailableBadge availability={l.availability} />
                </div>
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
                <SafetyBadge score={l.safetyScore} />
                <CommentCount count={l.commentCount} />
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
            <div className="flex items-center gap-2">
              {l.canDelete ? (
                <input
                  type="checkbox"
                  checked={checkedIds.has(l.id)}
                  onChange={() => onToggleCheck(l.id)}
                  className="w-4 h-4 cursor-pointer"
                  aria-label={`Select ${l.title ?? l.address ?? "listing"}`}
                />
              ) : null}
              <PriorityEditor
                key={`pri-${l.id}-${l.priority ?? "null"}`}
                listingId={l.id}
                current={l.priority}
              />
              <ContactStatusEditor
                key={`cs-${l.id}-${l.contactStatus ?? "null"}`}
                listingId={l.id}
                current={l.contactStatus}
              />
            </div>
            <div className="flex items-center gap-3">
              <WhatsAppShareLink url={buildWhatsAppShareUrl(l, `${appBaseUrl}/listings/${l.id}`)} />
              {l.canDelete ? (
                <DeleteListingButton
                  listingId={l.id}
                  label="Delete"
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
                />
              ) : null}
            </div>
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
  checkedIds,
  onToggleCheck,
  appBaseUrl,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  appBaseUrl: string;
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
          title={l.title}
          address={l.address}
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
          contactStatus={l.contactStatus}
          commentCount={l.commentCount}
          possibleDuplicate={l.possibleDuplicate}
          whatsappUrl={buildWhatsAppShareUrl(l, `${appBaseUrl}/listings/${l.id}`)}
          neighborhood={l.neighborhood}
          district={l.district}
          safetyScore={l.safetyScore}
          listingLat={l.latitude}
          listingLng={l.longitude}
          selected={selectedListingId === l.id}
          checked={checkedIds.has(l.id)}
          onToggleCheck={l.canDelete ? () => onToggleCheck(l.id) : undefined}
        />
      ))}
    </ul>
  );
}

function TableView({
  listings,
  selectedListingId,
  autoScroll,
  checkedIds,
  onToggleCheck,
  appBaseUrl,
}: {
  listings: HomeListingItem[];
  selectedListingId: string | null;
  autoScroll: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  appBaseUrl: string;
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
            <th className="px-3 py-2 text-left font-medium">Area</th>
            <th className="px-3 py-2 text-right font-medium">BR</th>
            <th className="px-3 py-2 text-right font-medium">BA</th>
            <th className="px-3 py-2 text-right font-medium">Sqft</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">PK</th>
            <th className="px-3 py-2 text-right font-medium">Safety</th>
            <th className="px-3 py-2 text-left font-medium">Transit</th>
            <th className="px-3 py-2 text-left font-medium">Labels</th>
            <th className="px-3 py-2 text-right font-medium" title="Comments">
              💬
            </th>
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
              checked={checkedIds.has(l.id)}
              onToggleCheck={() => onToggleCheck(l.id)}
              appBaseUrl={appBaseUrl}
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
  checked,
  onToggleCheck,
  appBaseUrl,
}: {
  listing: HomeListingItem;
  selected: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  appBaseUrl: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const beds = asNum(l.bedrooms);
  const baths = asNum(l.bathrooms);
  return (
    <tr
      data-listing-id={l.id}
      onClick={(e) => {
        if (l.canDelete && !isInteractiveTarget(e.target)) onToggleCheck();
      }}
      className={`transition-colors align-top ${
        checked
          ? "bg-destructive/15 outline outline-1 outline-destructive/50"
          : selected
            ? "bg-primary/25 outline outline-2 outline-primary"
            : "hover:bg-muted/40"
      } ${l.canDelete ? "cursor-pointer" : ""}`}
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
          className="block hover:underline"
          title={l.title ?? l.address ?? "Unknown address"}
        >
          <span className="font-medium line-clamp-1 block">
            {l.title ?? l.address ?? "Unknown address"}
          </span>
          {l.title && l.address && l.title !== l.address ? (
            <span className="text-sm text-muted-foreground line-clamp-1 block">
              {l.address}
            </span>
          ) : null}
        </Link>
        {l.possibleDuplicate ? (
          <div className="mt-1">
            <DuplicateBadge />
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-muted-foreground">{l.neighborhood ?? "—"}</span>
          {l.district ? (
            <span className="text-muted-foreground/70">{l.district}</span>
          ) : null}
        </div>
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
      <td
        className={`px-3 py-2 text-right tabular-nums ${
          l.safetyScore != null ? safetyClass(l.safetyScore) : ""
        }`}
        title={
          l.safetyScore != null
            ? `Safety: ${l.safetyScore}/100. Compared to your home — 50 = same as home, higher = safer.`
            : undefined
        }
      >
        {l.safetyScore != null ? l.safetyScore : "—"}
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
      <td className="px-3 py-2 text-right tabular-nums">
        {l.commentCount > 0 ? l.commentCount : "—"}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <UnavailableBadge availability={l.availability} />
          <ContactStatusEditor
            key={`cs-${l.id}-${l.contactStatus ?? "null"}`}
            listingId={l.id}
            current={l.contactStatus}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-1">
          <WhatsAppShareLink url={buildWhatsAppShareUrl(l, `${appBaseUrl}/listings/${l.id}`)} />
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

// Indices of the "best" values in a compare row (min or max), only when at
// least two values are comparable — so a lone value isn't crowned a winner.
function bestIndices(values: (number | null)[], dir: "min" | "max"): Set<number> {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  if (valid.length < 2) return new Set();
  const best =
    dir === "min"
      ? Math.min(...valid.map((x) => x.v))
      : Math.max(...valid.map((x) => x.v));
  return new Set(valid.filter((x) => x.v === best).map((x) => x.i));
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background text-left font-medium text-muted-foreground px-3 py-2 align-top whitespace-nowrap border-r border-border">
        {label}
      </th>
      {children}
    </tr>
  );
}

function CompareModal({
  items,
  pois,
  onClose,
}: {
  items: HomeListingItem[];
  pois: HomeMapProps["pois"];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ppsf = (l: HomeListingItem): number | null =>
    l.priceUsd != null && l.squareFeet ? l.priceUsd / l.squareFeet : null;

  const bestPrice = bestIndices(
    items.map((l) => l.priceUsd),
    "min",
  );
  const bestPpsf = bestIndices(items.map(ppsf), "min");
  const bestSafety = bestIndices(
    items.map((l) => l.safetyScore),
    "max",
  );
  const bestPk = bestIndices(
    items.map((l) => l.nearestPkRating),
    "max",
  );

  const winner = "font-semibold text-emerald-700 dark:text-emerald-400";
  const cell = "px-3 py-2 align-top whitespace-nowrap";
  const poiList = pois ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg border border-border shadow-xl my-8 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            Compare {items.length} listing{items.length === 1 ? "" : "s"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-muted-foreground hover:text-foreground px-2"
          >
            ×
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <tbody className="divide-y divide-border">
              <CompareRow label="">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.coverUrl}
                        alt={l.address ?? "Listing"}
                        className="w-32 h-24 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-32 h-24 rounded bg-muted" />
                    )}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Address">
                {items.map((l) => (
                  <td key={l.id} className="px-3 py-2 align-top max-w-[220px]">
                    <Link
                      href={`/listings/${l.id}`}
                      className="font-medium hover:underline"
                    >
                      {l.title ?? l.address ?? "Unknown address"}
                    </Link>
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Price">
                {items.map((l, i) => (
                  <td
                    key={l.id}
                    className={`${cell} ${bestPrice.has(i) ? winner : ""}`}
                  >
                    {fmtPrice(l.priceUsd) ?? "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="$/sqft">
                {items.map((l, i) => {
                  const v = ppsf(l);
                  return (
                    <td
                      key={l.id}
                      className={`${cell} ${bestPpsf.has(i) ? winner : ""}`}
                    >
                      {v != null ? `$${v.toFixed(2)}` : "—"}
                    </td>
                  );
                })}
              </CompareRow>
              <CompareRow label="Beds">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.bedrooms ?? "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Baths">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.bathrooms ?? "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Sq ft">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.squareFeet != null
                      ? l.squareFeet.toLocaleString("en-US")
                      : "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Area">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {fmtLocale(l.neighborhood, l.district) ?? "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Availability">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.availability === "available"
                      ? "Available"
                      : l.availability === "unavailable"
                        ? "Unavailable"
                        : "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Status">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {contactStatusLabel(l.contactStatus) ?? "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Safety">
                {items.map((l, i) => (
                  <td
                    key={l.id}
                    className={`${cell} ${
                      bestSafety.has(i)
                        ? winner
                        : l.safetyScore != null
                          ? safetyClass(l.safetyScore)
                          : ""
                    }`}
                  >
                    {l.safetyScore != null ? l.safetyScore : "—"}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="PK rating">
                {items.map((l, i) => (
                  <td
                    key={l.id}
                    className={`${cell} ${bestPk.has(i) ? winner : ""}`}
                  >
                    {l.nearestPkRating != null ? `${l.nearestPkRating}/10` : "—"}
                  </td>
                ))}
              </CompareRow>
              {poiList.map((p) => {
                const durs = items.map(
                  (l) =>
                    l.poiDistances.find((d) => d.poiId === p.id)
                      ?.durationSeconds ?? null,
                );
                const best = bestIndices(durs, "min");
                return (
                  <CompareRow key={p.id} label={`🚌 ${p.label}`}>
                    {items.map((l, i) => (
                      <td
                        key={l.id}
                        className={`${cell} ${best.has(i) ? winner : ""}`}
                      >
                        {fmtTransitDuration(durs[i]) ?? "—"}
                      </td>
                    ))}
                  </CompareRow>
                );
              })}
              <CompareRow label="Labels">
                {items.map((l) => (
                  <td key={l.id} className="px-3 py-2 align-top">
                    {l.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
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
                      "—"
                    )}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Comments">
                {items.map((l) => (
                  <td key={l.id} className={cell}>
                    {l.commentCount > 0 ? `💬 ${l.commentCount}` : "—"}
                  </td>
                ))}
              </CompareRow>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BulkActionBar({
  count,
  onDelete,
  onClear,
  onCompare,
  pending,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  onCompare: () => void;
  pending: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-background shadow-xl">
      <span className="text-sm font-medium tabular-nums">
        {count} {count === 1 ? "listing" : "listings"} selected
      </span>
      <button
        type="button"
        onClick={onCompare}
        disabled={count < 2}
        title={count < 2 ? "Select 2 or more to compare" : undefined}
        className="px-3 py-1.5 rounded border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        Compare
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Moving to Trash…" : "Move to Trash"}
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={pending}
        className="text-muted-foreground hover:text-foreground text-lg leading-none disabled:opacity-60 px-1"
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
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
