export type Json = unknown;

export function safeJsonParse(s: string): Json {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function get(obj: Json, ...keys: (string | number)[]): Json {
  let cur: Json = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, Json>)[k];
  }
  return cur;
}

export function asNum(v: Json): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asString(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

export function extractFirstJsonLd(html: string): Json {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? safeJsonParse(m[1]) : null;
}

import type { ParsedUnit } from "../types";

// Dedup a list of units by (beds, baths, sqft, price) — same plan + same
// price collapses to one row — and sort by price ascending.
export function dedupUnits(units: ParsedUnit[]): ParsedUnit[] {
  const seen = new Set<string>();
  const distinct: ParsedUnit[] = [];
  for (const u of units) {
    const key = `${u.beds}|${u.baths}|${u.sqft}|${u.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(u);
  }
  distinct.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  return distinct;
}

// Headline = the unit shown in single-value columns (home page card).
// Priority: 3BR + 2BA with a real price → cheapest. Then: cheapest with a
// real price. Last resort: first unit. Shared between every multi-unit
// source so the home page card stays consistent.
export function pickHeadlineUnit(units: ParsedUnit[]): ParsedUnit | null {
  if (units.length === 0) return null;
  const target = units.filter(
    (u) => u.beds === 3 && u.baths === 2 && u.price != null && u.price > 0,
  );
  if (target.length > 0) {
    return [...target].sort(
      (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    )[0];
  }
  const priced = units.filter((u) => u.price != null && u.price > 0);
  if (priced.length > 0) {
    return [...priced].sort(
      (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    )[0];
  }
  return units[0];
}
