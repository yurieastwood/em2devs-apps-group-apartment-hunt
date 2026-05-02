// Chicago safety adapter — pulls reported incidents from the City of
// Chicago's open-data Socrata endpoint and computes a 0–100 score per the
// project's documented formula:
//
//   severity weights:   violent = 5, property = 2, quality-of-life = 1
//   time-decay weights: last 30d = 1.0, last 6mo = 0.5, last 2y = 0.2
//   raw = Σ(severity × time-decay) for incidents within 0.25 mi
//   normalized = clamp(0..100, 100 × (1 − raw / 60))   // 60 ≈ 95th-pct raw
//
// Free, no API key required. We're polite to the endpoint by including a
// User-Agent and bounding the radius/time window tightly.

import type {
  SafetyBreakdown,
  SafetyCategory,
  SafetyResult,
  SafetyTimeBucket,
} from "./types";

const CHICAGO_USER_AGENT =
  "ApartmentHuntFamilyApp/1.0 (https://www.group-apartment-hunt.xyz)";

const ENDPOINT = "https://data.cityofchicago.org/resource/ijzp-q8t2.json";

const RADIUS_MI = 0.25;
const RADIUS_M = Math.round(RADIUS_MI * 1609.344); // ≈ 402

// Loose Chicago bounding box; outside it we skip the API call entirely.
const CHICAGO_BBOX = {
  minLat: 41.6,
  maxLat: 42.1,
  minLng: -88.0,
  maxLng: -87.5,
};

const SEVERITY_WEIGHT: Record<SafetyCategory, number> = {
  violent: 5,
  property: 2,
  qualityOfLife: 1,
};

// Calibration anchor: raw at which the score hits 0 ("very unsafe"). Set to
// 400 based on observed Chicago raw values across a sample library: median
// ~220, range 147–280+. With B=400 the formula `100 × (1 − raw/B)` puts:
//   raw   0 → 100 (very safe)
//   raw  50 →  87 (much safer than average)
//   raw 200 →  50 (Chicago average)
//   raw 280 →  30 (busier than average)
//   raw 400 →   0 (very unsafe)
// Bump or lower this single value to tune the spread for your data.
const RAW_BENCHMARK = 400;

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_DECAY: Array<{ maxAgeDays: number; weight: number }> = [
  { maxAgeDays: 30, weight: 1.0 },
  { maxAgeDays: 182, weight: 0.5 }, // ~6 months
  { maxAgeDays: 730, weight: 0.2 }, // 2 years
];
const MAX_AGE_DAYS = TIME_DECAY[TIME_DECAY.length - 1].maxAgeDays;

// Chicago "Primary Type" → severity bucket. Aligned with FBI Part-1 (violent
// vs property) where applicable; everything else lands in quality-of-life.
const CATEGORY_MAP: Record<string, SafetyCategory> = {
  HOMICIDE: "violent",
  "CRIMINAL SEXUAL ASSAULT": "violent",
  "CRIM SEXUAL ASSAULT": "violent",
  "SEX OFFENSE": "violent",
  ROBBERY: "violent",
  ASSAULT: "violent",
  BATTERY: "violent",
  KIDNAPPING: "violent",
  "OFFENSE INVOLVING CHILDREN": "violent",
  "HUMAN TRAFFICKING": "violent",
  INTIMIDATION: "violent",
  STALKING: "violent",
  "WEAPONS VIOLATION": "violent",
  ARSON: "violent",

  BURGLARY: "property",
  THEFT: "property",
  "MOTOR VEHICLE THEFT": "property",
  "CRIMINAL DAMAGE": "property",
  "CRIMINAL TRESPASS": "property",
  "DECEPTIVE PRACTICE": "property",
};

function bucketize(category: string): SafetyCategory {
  return CATEGORY_MAP[category.toUpperCase()] ?? "qualityOfLife";
}

function timeWeight(ageDays: number): number {
  for (const tier of TIME_DECAY) {
    if (ageDays <= tier.maxAgeDays) return tier.weight;
  }
  return 0;
}

function timeBucket(ageDays: number): SafetyTimeBucket | null {
  if (ageDays <= 30) return "last30Days";
  if (ageDays <= 182) return "last6Months";
  if (ageDays <= 730) return "last2Years";
  return null;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function isInChicago(lat: number, lng: number): boolean {
  return (
    lat >= CHICAGO_BBOX.minLat &&
    lat <= CHICAGO_BBOX.maxLat &&
    lng >= CHICAGO_BBOX.minLng &&
    lng <= CHICAGO_BBOX.maxLng
  );
}

type IncidentRow = {
  primary_type?: string;
  date?: string;
};

export async function computeChicagoSafety(
  lat: number,
  lng: number,
): Promise<SafetyResult | null> {
  if (!isInChicago(lat, lng)) return null;

  const sinceIso = new Date(
    Date.now() - MAX_AGE_DAYS * DAY_MS,
  ).toISOString();
  // Socrata's date columns use the floating-no-tz format `YYYY-MM-DDTHH:MM:SS`.
  const sinceCompact = sinceIso.slice(0, 19);

  const where = [
    `within_circle(location, ${lat}, ${lng}, ${RADIUS_M})`,
    `date > '${sinceCompact}'`,
  ].join(" AND ");

  const url = new URL(ENDPOINT);
  url.searchParams.set("$where", where);
  url.searchParams.set("$select", "primary_type,date");
  url.searchParams.set("$limit", "50000");

  let rows: IncidentRow[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": CHICAGO_USER_AGENT },
    });
    if (!res.ok) {
      console.error("Chicago Open Data HTTP", res.status, await res.text());
      return null;
    }
    rows = (await res.json()) as IncidentRow[];
  } catch (err) {
    console.error("Chicago Open Data request failed:", err);
    return null;
  }

  const byCategory: SafetyBreakdown["byCategory"] = {
    violent: { count: 0, weighted: 0 },
    property: { count: 0, weighted: 0 },
    qualityOfLife: { count: 0, weighted: 0 },
  };
  const byBucket: SafetyBreakdown["byBucket"] = {
    last30Days: 0,
    last6Months: 0,
    last2Years: 0,
  };

  let raw = 0;
  const now = Date.now();
  for (const r of rows) {
    if (!r.date) continue;
    const ts = Date.parse(r.date);
    if (!Number.isFinite(ts)) continue;
    const ageDays = (now - ts) / DAY_MS;
    const tWeight = timeWeight(ageDays);
    if (tWeight === 0) continue;
    const cat = bucketize(r.primary_type ?? "");
    const sWeight = SEVERITY_WEIGHT[cat];
    const points = sWeight * tWeight;
    raw += points;
    byCategory[cat].count += 1;
    byCategory[cat].weighted += points;
    const bucket = timeBucket(ageDays);
    if (bucket) byBucket[bucket] += 1;
  }

  const normalized = clampScore(100 * (1 - raw / RAW_BENCHMARK));
  return {
    score: normalized,
    breakdown: {
      normalized,
      raw: Math.round(raw * 10) / 10,
      radiusMeters: RADIUS_M,
      computedAt: new Date().toISOString(),
      source: "chicago-open-data",
      byCategory,
      byBucket,
    },
  };
}
