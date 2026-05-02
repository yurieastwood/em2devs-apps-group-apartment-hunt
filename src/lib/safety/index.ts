// Per-city router for the safety-score adapter. Each city plugs in its own
// data source behind a uniform `(lat, lng) → SafetyResult | null` shape.
// Today: Chicago via the Open Data API. Future: extend the registry here.

import { computeChicagoSafety } from "./chicago";
import type { SafetyResult } from "./types";

export type { SafetyResult, SafetyBreakdown } from "./types";

type Adapter = (lat: number, lng: number) => Promise<SafetyResult | null>;

// Adapters are tried in order; the first one that returns non-null wins.
// Each adapter does its own bbox / coverage check and returns null when the
// coordinate is outside its supported area.
const ADAPTERS: Adapter[] = [computeChicagoSafety];

export async function computeSafetyScore(
  lat: number | null,
  lng: number | null,
): Promise<SafetyResult | null> {
  if (lat == null || lng == null) return null;
  for (const adapter of ADAPTERS) {
    const result = await adapter(lat, lng);
    if (result) return result;
  }
  return null;
}
