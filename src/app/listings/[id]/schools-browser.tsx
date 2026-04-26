"use client";

import { useMemo, useState } from "react";

const GRADE_BANDS = ["PK", "K", "Elementary", "Middle", "High"] as const;
type GradeBand = (typeof GRADE_BANDS)[number];

type SortOption =
  | "distance-asc"
  | "distance-desc"
  | "rating-desc"
  | "rating-asc"
  | "name-asc";

const RATING_THRESHOLDS = [0, 4, 7, 9] as const;

export type SchoolRow = {
  id: string;
  name: string;
  schoolType: string | null;
  gradeRange: string | null;
  rating: number | null;
  distanceMiles: string | null;
  isAssigned: boolean | null;
  greatSchoolsUrl: string | null;
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Parse a grade-range string like "PK-8" or "9-12" or "K" into the broad
// bands the UI offers. PK = -1, K = 0, 1..12 = themselves; bands include any
// they overlap.
function parseGradeRange(range: string | null): GradeBand[] {
  if (!range) return [];
  const parts = range.split("-").map((s) => s.trim());
  const toNum = (t: string): number | null => {
    const u = t.toUpperCase();
    if (u === "PK") return -1;
    if (u === "K") return 0;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  };
  const start = toNum(parts[0]);
  const end = parts.length >= 2 ? toNum(parts[1]) : start;
  if (start == null || end == null) return [];
  const bands: GradeBand[] = [];
  if (start <= -1 && end >= -1) bands.push("PK");
  if (start <= 0 && end >= 0) bands.push("K");
  if (start <= 5 && end >= 1) bands.push("Elementary");
  if (start <= 8 && end >= 6) bands.push("Middle");
  if (start <= 12 && end >= 9) bands.push("High");
  return bands;
}

function distOrInf(s: SchoolRow): number {
  if (!s.distanceMiles) return Number.POSITIVE_INFINITY;
  const d = parseFloat(s.distanceMiles);
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
}

function ratingOr(s: SchoolRow, fallback: number): number {
  return s.rating ?? fallback;
}

function toggleSetMember(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function ratingColorClasses(rating: number): string {
  if (rating <= 3)
    return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40";
  if (rating <= 6)
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40";
  return "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/40";
}

function fmtMeta(s: SchoolRow): string {
  const parts: string[] = [];
  if (s.schoolType) parts.push(titleCase(s.schoolType));
  if (s.gradeRange) parts.push(s.gradeRange);
  if (s.isAssigned === true) parts.push("Attendance zone");
  else if (s.distanceMiles) {
    const mi = parseFloat(s.distanceMiles);
    if (Number.isFinite(mi)) parts.push(`${mi.toFixed(1)} mi away`);
  }
  return parts.join(" · ");
}

export function SchoolsBrowser({ schools }: { schools: SchoolRow[] }) {
  const [sort, setSort] = useState<SortOption>("distance-asc");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeBands, setActiveBands] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const s of schools) {
      if (s.schoolType) set.add(titleCase(s.schoolType));
    }
    return [...set].sort();
  }, [schools]);

  const visible = useMemo(() => {
    const filtered = schools.filter((s) => {
      if (activeTypes.size > 0) {
        if (!s.schoolType || !activeTypes.has(titleCase(s.schoolType))) {
          return false;
        }
      }
      if (activeBands.size > 0) {
        const bands = parseGradeRange(s.gradeRange);
        if (!bands.some((b) => activeBands.has(b))) return false;
      }
      if (minRating > 0) {
        if (s.rating == null || s.rating < minRating) return false;
      }
      return true;
    });

    const sorter: Record<SortOption, (a: SchoolRow, b: SchoolRow) => number> = {
      "distance-asc": (a, b) => distOrInf(a) - distOrInf(b),
      "distance-desc": (a, b) => distOrInf(b) - distOrInf(a),
      "rating-desc": (a, b) => ratingOr(b, -1) - ratingOr(a, -1),
      "rating-asc": (a, b) => ratingOr(a, 11) - ratingOr(b, 11),
      "name-asc": (a, b) => a.name.localeCompare(b.name),
    };
    return [...filtered].sort(sorter[sort]);
  }, [schools, activeTypes, activeBands, minRating, sort]);

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
            <option value="distance-asc">Nearest first</option>
            <option value="distance-desc">Farthest first</option>
            <option value="rating-desc">Highest rating</option>
            <option value="rating-asc">Lowest rating</option>
            <option value="name-asc">Name (A–Z)</option>
          </select>
        </label>

        {availableTypes.length > 1 ? (
          <PillGroup
            label="Type"
            options={availableTypes}
            active={activeTypes}
            onToggle={(v) =>
              setActiveTypes((prev) => toggleSetMember(prev, v))
            }
          />
        ) : null}

        <PillGroup
          label="Grade"
          options={[...GRADE_BANDS]}
          active={activeBands}
          onToggle={(v) =>
            setActiveBands((prev) => toggleSetMember(prev, v))
          }
        />

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Min rating</span>
          <div className="flex gap-1">
            {RATING_THRESHOLDS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMinRating(t)}
                aria-pressed={minRating === t}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  minRating === t
                    ? "bg-primary/15 border-primary text-foreground"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {t === 0 ? "Any" : `${t}+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No schools match these filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li
              key={s.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {s.greatSchoolsUrl ? (
                    <a
                      href={s.greatSchoolsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{fmtMeta(s)}</p>
              </div>
              {s.rating != null ? (
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium tabular-nums ${ratingColorClasses(s.rating)}`}
                  title="GreatSchools rating"
                >
                  {s.rating}/10
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PillGroup({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: string[];
  active: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const isOn = active.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              aria-pressed={isOn}
              className={`px-2 py-0.5 rounded border transition-colors ${
                isOn
                  ? "bg-primary/15 border-primary text-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
