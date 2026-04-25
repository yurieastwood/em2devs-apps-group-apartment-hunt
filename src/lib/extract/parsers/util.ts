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
