import { NextResponse } from "next/server";
import { fetchListingHtml } from "@/lib/extract/fetch-listing";
import { profileForUrl } from "@/lib/extract/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PROBE_URLS = [
  "https://www.zillow.com/homedetails/2346-W-Grand-Ave-1N-Chicago-IL-60612/2070907398_zpid/",
  "https://www.apartments.com/2811-w-jackson-blvd-chicago-il/c3jjb9f/",
];

type ProbeResult =
  | { url: string; ok: true; status: number; title: string | null; bytes: number; ms: number }
  | { url: string; ok: false; status?: number; error: string; ms: number };

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

async function probe(url: string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const { status, html } = await fetchListingHtml(url, {
      profile: profileForUrl(url),
    });
    const ms = Date.now() - started;
    if (status === 200) {
      return { url, ok: true, status, title: extractTitle(html), bytes: html.length, ms };
    }
    return { url, ok: false, status, error: `HTTP ${status}`, ms };
  } catch (err) {
    return {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    };
  }
}

export async function GET() {
  const started = Date.now();
  const results = await Promise.all(PROBE_URLS.map(probe));
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    totalMs: Date.now() - started,
    results,
  });
}
