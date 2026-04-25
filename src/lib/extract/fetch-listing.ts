import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { profileCandidates } from "./profiles";

const DEFAULT_BIN = path.join(process.cwd(), "bin", "curl-impersonate");

export type FetchOptions = {
  profile?: string;
  referer?: string;
  cookieJar?: string;
  timeoutMs?: number;
};

export type FetchListingResult = {
  status: number;
  html: string;
};

export type FetchBinaryResult = {
  status: number;
  contentType: string | null;
  buffer: Buffer;
};

export type FetchListingResultWithProfile = FetchListingResult & {
  usedProfile: string;
  triedProfiles: string[];
};

type CurlResult = {
  status: number;
  contentType: string | null;
  bodyFile: string;
};

async function curlFetch(
  url: string,
  opts: FetchOptions = {},
): Promise<CurlResult> {
  const {
    profile = "chrome146",
    referer,
    cookieJar,
    timeoutMs = 20_000,
  } = opts;
  const bin = process.env.CURL_IMPERSONATE_BIN ?? DEFAULT_BIN;
  const bodyFile = path.join("/tmp", `ci-${randomUUID()}`);

  const args: string[] = [
    "--impersonate",
    profile,
    "--compressed",
    "--silent",
    "--location",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "--output",
    bodyFile,
    "--write-out",
    "%{http_code}\n%{content_type}",
  ];
  if (referer) args.push("--referer", referer);
  if (cookieJar) args.push("--cookie", cookieJar, "--cookie-jar", cookieJar);
  args.push(url);

  return new Promise<CurlResult>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(bin, args);
    child.stdout.on("data", (c) => stdout.push(c));
    child.stderr.on("data", (c) => stderr.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `curl-impersonate exited ${code}: ${Buffer.concat(stderr).toString()}`,
          ),
        );
        return;
      }
      const lines = Buffer.concat(stdout).toString().trim().split("\n");
      const status = Number(lines[0]);
      const contentType = lines[1]?.split(";")[0]?.trim() || null;
      if (!Number.isFinite(status)) {
        reject(new Error(`could not parse http status from curl stdout`));
        return;
      }
      resolve({ status, contentType, bodyFile });
    });
  });
}

export async function fetchListingHtml(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchListingResult> {
  const { status, bodyFile } = await curlFetch(url, opts);
  try {
    const html = await fs.readFile(bodyFile, "utf8");
    return { status, html };
  } finally {
    await fs.unlink(bodyFile).catch(() => {});
  }
}

export async function fetchUrlBinary(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchBinaryResult> {
  const { status, contentType, bodyFile } = await curlFetch(url, opts);
  try {
    const buffer = await fs.readFile(bodyFile);
    return { status, contentType, buffer };
  } finally {
    await fs.unlink(bodyFile).catch(() => {});
  }
}

// Higher-level: tries profile candidates in order, returns the first that
// yields HTTP 200. If none succeeds, returns the last attempted result so
// callers can inspect status/html for the failure.
export async function fetchListing(
  url: string,
  opts: Omit<FetchOptions, "profile"> = {},
): Promise<FetchListingResultWithProfile> {
  const candidates = profileCandidates(url);
  const tried: string[] = [];
  let lastResult: FetchListingResult | undefined;

  for (const profile of candidates) {
    tried.push(profile);
    const result = await fetchListingHtml(url, { ...opts, profile });
    lastResult = result;
    if (result.status === 200) {
      return { ...result, usedProfile: profile, triedProfiles: tried };
    }
  }

  if (!lastResult) {
    throw new Error(`no profile candidates configured for ${url}`);
  }
  return {
    ...lastResult,
    usedProfile: tried[tried.length - 1],
    triedProfiles: tried,
  };
}
