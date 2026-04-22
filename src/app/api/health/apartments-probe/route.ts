import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fetchListingHtml } from "@/lib/extract/fetch-listing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LISTING_URL =
  "https://www.apartments.com/2811-w-jackson-blvd-chicago-il/c3jjb9f/";
const HOMEPAGE_URL = "https://www.apartments.com/";

type ProbeOutcome = {
  key: string;
  ok: boolean;
  status?: number;
  title?: string | null;
  bytes?: number;
  ms: number;
  error?: string;
};

function titleOf(html: string): string | null {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
}

async function runProbe(
  key: string,
  exec: () => Promise<{ status: number; html: string }>,
): Promise<ProbeOutcome> {
  const started = Date.now();
  try {
    const { status, html } = await exec();
    return {
      key,
      ok: status === 200,
      status,
      title: titleOf(html),
      bytes: html.length,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      key,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const started = Date.now();
  const results: ProbeOutcome[] = [];

  for (const profile of [
    "chrome146",
    "firefox147",
    "safari260",
    "edge101",
  ]) {
    results.push(
      await runProbe(profile, () =>
        fetchListingHtml(LISTING_URL, { profile }),
      ),
    );
  }

  results.push(
    await runProbe("chrome146+google_referer", () =>
      fetchListingHtml(LISTING_URL, {
        profile: "chrome146",
        referer: "https://www.google.com/",
      }),
    ),
  );

  const jar = path.join("/tmp", `jar-${randomUUID()}.txt`);
  try {
    await fs.writeFile(jar, "");
    results.push(
      await runProbe("chrome146+session_warmup", async () => {
        await fetchListingHtml(HOMEPAGE_URL, {
          profile: "chrome146",
          cookieJar: jar,
        });
        return fetchListingHtml(LISTING_URL, {
          profile: "chrome146",
          cookieJar: jar,
          referer: HOMEPAGE_URL,
        });
      }),
    );
  } finally {
    await fs.unlink(jar).catch(() => {});
  }

  return NextResponse.json({
    ok: results.some((r) => r.ok),
    totalMs: Date.now() - started,
    passingProbes: results.filter((r) => r.ok).map((r) => r.key),
    results,
  });
}
