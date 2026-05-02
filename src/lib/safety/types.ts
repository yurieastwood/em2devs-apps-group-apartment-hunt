// Per-listing safety score derived from local crime activity within a fixed
// radius. Designed as an interface so each city can plug in its own data
// source (Chicago Open Data today; future cities later).

export type SafetyCategory = "violent" | "property" | "qualityOfLife";

export type SafetyTimeBucket = "last30Days" | "last6Months" | "last2Years";

export type SafetyBreakdown = {
  // 0-100 score; 100 = very safe, 50 = average, 0 = very unsafe.
  normalized: number;
  // Sum of severity × time-decay across in-radius incidents.
  raw: number;
  // Search radius in meters used to gather incidents.
  radiusMeters: number;
  // ISO timestamp of when this score was computed.
  computedAt: string;
  // Data source identifier so we can later distinguish per city.
  source: string;
  // Counts (and weighted sums) per category, helpful for the detail page.
  byCategory: Record<SafetyCategory, { count: number; weighted: number }>;
  // Counts per time bucket — gives a sense of recency at a glance.
  byBucket: Record<SafetyTimeBucket, number>;
  // Full category × bucket grid for the detail-page breakdown table.
  // Optional so that older breakdowns (before this field was added) still
  // typecheck; the UI falls back to byCategory/byBucket when absent.
  byCategoryAndBucket?: Record<
    SafetyCategory,
    Record<SafetyTimeBucket, number>
  >;
};

export type SafetyResult = {
  score: number; // 0-100
  breakdown: SafetyBreakdown;
};
