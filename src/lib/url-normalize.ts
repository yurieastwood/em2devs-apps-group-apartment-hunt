// Normalizes a listing URL to a canonical form so dedup compares apples to
// apples. Conservative — keeps anything we can't be sure is noise.
//
// Returns null when the input isn't a parseable URL.
export function normalizeListingUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }

  // Force https — listing sites all serve over TLS, http variants redirect.
  u.protocol = "https:";
  // Lowercase host (DNS is case-insensitive; URL strings aren't).
  u.hostname = u.hostname.toLowerCase();
  // Fragment is purely client-side state, never identifies the listing.
  u.hash = "";

  // Strip well-known click/tracking params. Anything else is left alone — a
  // legit listing URL might carry useful query state (filters, region) that
  // we shouldn't second-guess.
  const TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "_gl",
    "mc_cid",
    "mc_eid",
    "igshid",
    "yclid",
    "_branch_match_id",
    "ref_source",
  ];
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);

  // Trim a single trailing slash from the pathname (but keep "/" itself).
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}
