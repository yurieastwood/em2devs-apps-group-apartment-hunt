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

const PERCENTILE_TOOLTIP =
  "Percentile rank within your library — 100 means safest in the library, 0 means least safe. The same score the home page shows.";

const MIN_MAX_TOOLTIP =
  "Min-max scaled — proportional to the gap between your safest and least-safe listings' raw incident scores. Preserves absolute differences but compresses the middle of the library when there are outliers.";

export function ListingSafetySection({
  score,
  minMaxScore,
  rank,
  total,
  breakdown,
}: {
  score: number | null;
  minMaxScore: number | null;
  rank: number | null;
  total: number | null;
  breakdown: unknown;
}) {
  if (score == null) return null;

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

  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold">Safety</h2>
        <span className="text-xs text-muted-foreground">
          0–100, higher is safer (relative to your library)
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-2">
        <span
          className={`text-3xl font-semibold tabular-nums ${safetyClass(score)}`}
          title={PERCENTILE_TOOLTIP}
        >
          🛡 {score}
        </span>
        <span
          className="text-xs text-muted-foreground cursor-help"
          title={PERCENTILE_TOOLTIP}
        >
          Percentile rank
        </span>
        {minMaxScore != null ? (
          <>
            <span
              className={`text-xl tabular-nums ${safetyClass(minMaxScore)}`}
              title={MIN_MAX_TOOLTIP}
            >
              {minMaxScore}
            </span>
            <span
              className="text-xs text-muted-foreground cursor-help"
              title={MIN_MAX_TOOLTIP}
            >
              Min-max scaled
            </span>
          </>
        ) : null}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="border border-border rounded p-3">
            <p className="text-xs text-muted-foreground mb-1">Violent</p>
            <p className="tabular-nums">{totals.byCategory.violent.count}</p>
          </div>
          <div className="border border-border rounded p-3">
            <p className="text-xs text-muted-foreground mb-1">Property</p>
            <p className="tabular-nums">{totals.byCategory.property.count}</p>
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
            <p className="text-xs text-muted-foreground mb-1">Last 30 days</p>
            <p className="tabular-nums">{totals.byBucket.last30Days}</p>
          </div>
          <div className="border border-border rounded p-3">
            <p className="text-xs text-muted-foreground mb-1">Last 6 months</p>
            <p className="tabular-nums">{totals.byBucket.last6Months}</p>
          </div>
          <div className="border border-border rounded p-3">
            <p className="text-xs text-muted-foreground mb-1">Last 2 years</p>
            <p className="tabular-nums">{totals.byBucket.last2Years}</p>
          </div>
        </div>
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
