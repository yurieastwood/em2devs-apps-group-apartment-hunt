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

export function ListingSafetySection({
  score,
  breakdown,
}: {
  score: number | null;
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
          0–100, higher is safer
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className={`text-3xl font-semibold tabular-nums ${safetyClass(score)}`}
        >
          🛡 {score}
        </span>
        {totals ? (
          <span className="text-sm text-muted-foreground">
            within {fmtMiles(totals.radiusMeters)} • raw {totals.raw}
          </span>
        ) : null}
      </div>

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
        </p>
      ) : null}
    </section>
  );
}
