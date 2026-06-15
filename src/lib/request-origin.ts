import { headers } from "next/headers";

// Absolute origin of the current request (e.g. https://app.example.com), used
// to build shareable in-app links. Derived from request headers so it's
// correct without env config; falls back to APP_BASE_URL.
export async function getAppOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
}
