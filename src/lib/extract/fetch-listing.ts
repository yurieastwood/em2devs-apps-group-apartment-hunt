import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

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

export async function fetchListingHtml(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchListingResult> {
  const {
    profile = "chrome146",
    referer,
    cookieJar,
    timeoutMs = 20_000,
  } = opts;
  const bin = process.env.CURL_IMPERSONATE_BIN ?? DEFAULT_BIN;
  const bodyFile = path.join("/tmp", `ci-${randomUUID()}.html`);

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
    "%{http_code}",
  ];
  if (referer) args.push("--referer", referer);
  if (cookieJar) args.push("--cookie", cookieJar, "--cookie-jar", cookieJar);
  args.push(url);

  const status = await new Promise<number>((resolve, reject) => {
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
      const parsed = Number(Buffer.concat(stdout).toString().trim());
      if (!Number.isFinite(parsed)) {
        reject(new Error(`could not parse http status from curl stdout`));
        return;
      }
      resolve(parsed);
    });
  });

  try {
    const html = await fs.readFile(bodyFile, "utf8");
    return { status, html };
  } finally {
    await fs.unlink(bodyFile).catch(() => {});
  }
}
