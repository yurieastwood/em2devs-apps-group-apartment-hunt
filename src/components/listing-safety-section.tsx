import type { SafetyBreakdown } from "@/lib/safety";

function safetyClass(score: number): string {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "text-lime-700 dark:text-lime-400";
  if (score >= 40) return "text-amber-700 dark:text-amber-400";
  if (score >= 20) return "text-orange-700 dark:text-orange-400";
  return "text-destructive";
}

function isBreakdown(v: unknown): v is SafetyBreakdown {
  return (
    typeof v === "object" &&
    v !== null &&
    "byCategory" in v &&
    "byBucket" in v
  );
}

function isBreakdownWithMatrix(
  v: unknown,
): v is SafetyBreakdown & {
  byCategoryAndBucket: NonNullable<SafetyBreakdown["byCategoryAndBucket"]>;
} {
  return (
    isBreakdown(v) &&
    "byCategoryAndBucket" in v &&
    typeof (v as SafetyBreakdown).byCategoryAndBucket === "object" &&
    (v as SafetyBreakdown).byCategoryAndBucket !== null
  );
}

const CATEGORY_LABELS: Record<keyof SafetyBreakdown["byCategory"], string> = {
  violent: "Violent",
  property: "Property",
  qualityOfLife: "Quality of life",
};

const BUCKET_LABELS: Record<keyof SafetyBreakdown["byBucket"], string> = {
  last30Days: "Last 30 days",
  last6Months: "Last 6 months",
  last2Years: "Last 2 years",
};

function SafetyMatrix({
  breakdown,
}: {
  breakdown: SafetyBreakdown & {
    byCategoryAndBucket: NonNullable<SafetyBreakdown["byCategoryAndBucket"]>;
  };
}) {
  const cats = Object.keys(CATEGORY_LABELS) as Array<
    keyof typeof CATEGORY_LABELS
  >;
  const buckets = Object.keys(BUCKET_LABELS) as Array<
    keyof typeof BUCKET_LABELS
  >;
  const matrix = breakdown.byCategoryAndBucket;
  const colTotals = buckets.map((b) =>
    cats.reduce((sum, c) => sum + (matrix[c]?.[b] ?? 0), 0),
  );
  const rowTotals = cats.map((c) =>
    buckets.reduce((sum, b) => sum + (matrix[c]?.[b] ?? 0), 0),
  );
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="border border-border rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            {buckets.map((b) => (
              <th key={b} className="px-3 py-2 text-right font-medium">
                {BUCKET_LABELS[b]}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cats.map((c, i) => (
            <tr key={c}>
              <td className="px-3 py-2 font-medium">{CATEGORY_LABELS[c]}</td>
              {buckets.map((b) => (
                <td
                  key={b}
                  className="px-3 py-2 text-right tabular-nums"
                >
                  {matrix[c]?.[b] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {rowTotals[i]}
              </td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-medium">
            <td className="px-3 py-2">Total</td>
            {colTotals.map((t, i) => (
              <td key={i} className="px-3 py-2 text-right tabular-nums">
                {t}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums">{grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function fmtMiles(m: number): string {
  return `${(m / 1609.344).toFixed(2)} mi`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const HOME_RELATIVE_TOOLTIP =
  "Compared to your current home address. 50 = exactly as safe as home; above 50 = safer than home; below 50 = less safe than home. Computed as 100 × home_raw / (home_raw + listing_raw).";

const PERCENTILE_TOOLTIP =
  "Percentile rank within your library — 100 means safest in the library, 0 means least safe. Spread is always 0–100 by construction.";

const MIN_MAX_TOOLTIP =
  "Min-max scaled — proportional to the gap between your safest and least-safe listings' raw incident scores. Preserves absolute differences but compresses the middle when there are outliers.";

export function ListingSafetySection({
  homeRelative,
  percentile,
  minMax,
  rank,
  total,
  breakdown,
}: {
  homeRelative: number | null;
  percentile: number | null;
  minMax: number | null;
  rank: number | null;
  total: number | null;
  breakdown: unknown;
}) {
  // Show the section if at least one score is available.
  if (homeRelative == null && percentile == null && minMax == null) {
    return null;
  }

  const totals = isBreakdown(breakdown)
    ? {
        byCategory: breakdown.byCategory,
        byBucket: breakdown.byBucket,
        radiusMeters: breakdown.radiusMeters,
        computedAt: breakdown.computedAt,
        source: breakdown.source,
        raw: breakdown.raw,
      }
    : null;

  // Pick the primary (big) score. Prefer home-relative; fall back to
  // percentile, then min-max.
  const primary =
    homeRelative != null
      ? {
          value: homeRelative,
          label: "vs home",
          tooltip: HOME_RELATIVE_TOOLTIP,
        }
      : percentile != null
        ? {
            value: percentile,
            label: "Percentile rank",
            tooltip: PERCENTILE_TOOLTIP,
          }
        : {
            value: minMax!,
            label: "Min-max scaled",
            tooltip: MIN_MAX_TOOLTIP,
          };

  // Secondary scores: skip whichever is the primary.
  const secondaries: Array<{
    value: number;
    label: string;
    tooltip: string;
  }> = [];
  if (primary.label !== "Percentile rank" && percentile != null) {
    secondaries.push({
      value: percentile,
      label: "Percentile rank",
      tooltip: PERCENTILE_TOOLTIP,
    });
  }
  if (primary.label !== "Min-max scaled" && minMax != null) {
    secondaries.push({
      value: minMax,
      label: "Min-max scaled",
      tooltip: MIN_MAX_TOOLTIP,
    });
  }

  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold">Safety</h2>
        <span className="text-xs text-muted-foreground">
          0–100, higher is safer
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-2">
        <span
          className={`text-3xl font-semibold tabular-nums ${safetyClass(primary.value)}`}
          title={primary.tooltip}
        >
          🛡 {primary.value}
        </span>
        <span
          className="text-xs text-muted-foreground cursor-help"
          title={primary.tooltip}
        >
          {primary.label}
        </span>
        {secondaries.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-baseline gap-1.5"
          >
            <span
              className={`text-xl tabular-nums ${safetyClass(s.value)}`}
              title={s.tooltip}
            >
              {s.value}
            </span>
            <span
              className="text-xs text-muted-foreground cursor-help"
              title={s.tooltip}
            >
              {s.label}
            </span>
          </span>
        ))}
      </div>

      {rank != null && total != null && total > 1 ? (
        <p className="text-sm text-muted-foreground mb-4">
          {rank === 1
            ? "Safest in your library"
            : rank === total
              ? "Least safe in your library"
              : `Rank ${rank} of ${total} (${rank - 1} listing${
                  rank - 1 === 1 ? "" : "s"
                } safer, ${total - rank} less safe)`}
        </p>
      ) : null}

      {totals ? (
        isBreakdownWithMatrix(breakdown) ? (
          <SafetyMatrix breakdown={breakdown} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Violent</p>
              <p className="tabular-nums">{totals.byCategory.violent.count}</p>
            </div>
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Property</p>
              <p className="tabular-nums">
                {totals.byCategory.property.count}
              </p>
            </div>
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Quality of life
              </p>
              <p className="tabular-nums">
                {totals.byCategory.qualityOfLife.count}
              </p>
            </div>
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Last 30 days
              </p>
              <p className="tabular-nums">{totals.byBucket.last30Days}</p>
            </div>
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Last 6 months
              </p>
              <p className="tabular-nums">{totals.byBucket.last6Months}</p>
            </div>
            <div className="border border-border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Last 2 years
              </p>
              <p className="tabular-nums">{totals.byBucket.last2Years}</p>
            </div>
          </div>
        )
      ) : null}

      {totals ? (
        <p className="text-xs text-muted-foreground mt-3">
          Source: {totals.source}. Computed {fmtWhen(totals.computedAt)}.
          Raw weighted incidents within {fmtMiles(totals.radiusMeters)}:{" "}
          <span className="tabular-nums">{totals.raw}</span>.
        </p>
      ) : null}
    </section>
  );
}
