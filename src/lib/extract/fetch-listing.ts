import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const DEFAULT_BIN = path.join(process.cwd(), "bin", "curl-impersonate");

export type FetchListingResult = {
  status: number;
  html: string;
};

export async function fetchListingHtml(
  url: string,
  timeoutMs = 20_000,
): Promise<FetchListingResult> {
  const bin = process.env.CURL_IMPERSONATE_BIN ?? DEFAULT_BIN;
  const bodyFile = path.join("/tmp", `ci-${randomUUID()}.html`);

  const status = await new Promise<number>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(bin, [
      "--impersonate",
      "chrome146",
      "--compressed",
      "--silent",
      "--location",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "--output",
      bodyFile,
      "--write-out",
      "%{http_code}",
      url,
    ]);
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
