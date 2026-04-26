import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "node:crypto";
import { fetchListing } from "@/lib/extract/fetch-listing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROBE_URLS = [
  "https://www.zillow.com/homedetails/2346-W-Grand-Ave-1N-Chicago-IL-60612/2070907398_zpid/",
  "https://www.apartments.com/2811-w-jackson-blvd-chicago-il/c3jjb9f/",
];

type ProbeResult =
  | {
      url: string;
      ok: true;
      status: number;
      title: string | null;
      bytes: number;
      usedProfile: string;
      triedProfiles: string[];
      ms: number;
    }
  | {
      url: string;
      ok: false;
      status?: number;
      error: string;
      triedProfiles: string[];
      ms: number;
    };

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

async function probe(url: string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const { status, html, usedProfile, triedProfiles } =
      await fetchListing(url);
    const ms = Date.now() - started;
    if (status === 200) {
      return {
        url,
        ok: true,
        status,
        title: extractTitle(html),
        bytes: html.length,
        usedProfile,
        triedProfiles,
        ms,
      };
    }
    return {
      url,
      ok: false,
      status,
      error: `HTTP ${status} after trying ${triedProfiles.join(", ")}`,
      triedProfiles,
      ms,
    };
  } catch (err) {
    return {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      triedProfiles: [],
      ms: Date.now() - started,
    };
  }
}

function checkBearerToken(req: Request): boolean {
  const expected = process.env.HEALTH_AUTH_TOKEN;
  if (!expected) return false;

  const header = req.headers.get("authorization");
  if (!header) return false;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}

async function isAuthorized(req: Request): Promise<boolean> {
  const { userId } = await auth();
  if (userId) return true;
  return checkBearerToken(req);
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="health"' },
    });
  }

  const started = Date.now();
  const results = await Promise.all(PROBE_URLS.map(probe));
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    totalMs: Date.now() - started,
    results,
  });
}
