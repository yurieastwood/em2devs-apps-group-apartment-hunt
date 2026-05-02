# Apartment Hunt — Roadmap

A personal, family-scoped app for sharing apartment listings during a lease hunt.

## Stack

Next.js 16 + TypeScript + Tailwind on Vercel · Neon Postgres + Drizzle ORM · Clerk auth + Organizations · Cloudflare R2 storage · Google Maps · `curl-impersonate` for source-page scraping.

## Status

- ✅ Done and live
- 🔄 In progress
- 📋 Planned, not started
- 💡 Backlog / nice-to-have

---

## Slice 0 — Infrastructure ✅

Project foundations: Next.js scaffold, database, auth, object storage, hosting, custom domain.

## Slice 1 — Listing-from-URL ✅

Paste a Zillow / Apartments.com / ApartmentList URL → a structured listing with rehosted photos and a detail page (carousel, lightbox, schools, photo errors).

## Slice 2 — Browse + Manage + Engage ✅

Listings index with filter + sort + view toggle, edit, delete, comments, reactions, Google Maps with home + listing pins, nearby-schools list with GreatSchools ratings.

## Slice 2.5 — Bulk import ✅

Paste many URLs on `/listings/new` (HTML or plain text); each one is processed sequentially with per-row status.

## Slice 2.6 — Auth-gated health endpoint ✅

`/api/health/scrape` requires a Clerk session or an `Authorization: Bearer <token>` header.

## Slice 2.7 — Points of interest with transit distances ✅

Add POIs (Work, school, family); each listing shows the transit time from itself to every POI.

## Slice 3 — Access control 🔄

Family-scoped visibility via Clerk Organizations and faster image loads via the public R2 bucket.

- ✅ R2 public bucket binding
- ✅ Listings, comments, reactions org-scoped
- ✅ Home address and POIs shared with the family
- 📋 Backfill UI for legacy personal-mode data
- 📋 Disable public sign-up in Clerk

## Slice 3.1 — Tags / labels ✅

User-defined labels for organizing the hunt — chips on cards and a filter on the home page.

## Slice 3.2 — Detail-page map ✅

Listing detail page renders a map with the listing's pin and every POI in the family, just before the comments section.

## Slice 3.3 — Listing priority ✅

Per-listing priority number, contiguous 1..N within the family. Anyone can re-prioritize from the cards, list rows, or detail page; the home page sorts by priority by default.

## Slice 3.4 — Multi-field sort ✅

Sort the home-page listings by any combination of fields (priority, date added, price, bedrooms, bathrooms, sq ft, PK rating). Each criterion is a chip you can reorder, flip ascending/descending, or remove.

## Slice 3.5 — Refresh + change log ✅

Daily cron and on-demand re-scraping of every listing. Tracks price and availability changes; renders a per-listing audit log on the detail page and a "what changed today" banner on the home page. Unavailable listings keep their data but get a badge and a Hide-unavailable filter chip.

## Slice 3.6 — Role-based access (admins vs members) ✅

Clerk Organization roles gate write features. Admins can add/edit/delete listings, manage home address and POIs, refresh all listings, and invite members. Members can browse, comment, react, re-prioritize, refresh a single listing, and delete their own listings/comments.

## Slice 3.7 — Customizable POI pin colors ✅

Each POI can pick a pin color from an 8-color palette on its add/edit form. Maps render the chosen color via Google's `<Pin background>`, so it stays cross-platform consistent. Existing POIs default to green (the previous look).

## Slice 3.8 — Neighborhood ✅

Per-listing neighborhood extracted from each source's parser, displayed under the address on cards / list rows / detail page, and filterable on the home page via a multi-select chip group.

## Slice 3.9 — Multi-unit Zillow building listings ✅

Zillow `/apartments/<city>/<slug>/<lnId>/` URLs (apartment buildings with many floor plans) now parse into a structured units array. The home page card highlights a 3BR + 2BA unit (cheapest match) when one exists, falling back to the cheapest priced unit. The detail page renders an "Available units" section listing every floor plan, with the headline unit highlighted.

## Slice 4.1 — Listing safety score ✅

Per-listing 0–100 safety score derived from local crime activity within 0.25 mi of the listing's coordinates. Chicago adapter uses the City of Chicago Open Data API (free, no key); per-city router so other cities can plug in later. Time-decayed and severity-weighted per the documented formula. Shown on home cards / list / table and as a breakdown on the detail page; sortable, filterable by minimum score; tracked in the change history alongside price and availability.

## Slice 4.0 — Soft delete + Trash ✅

Deleting a listing now soft-deletes it: the row stays, photos are kept, and the audit trail survives. Admins access an `/listings/deleted` page (linked as "Trash" in the header) to view soft-deleted listings, restore them, or permanently delete (purges row + R2 photos). The cron and per-listing manual refresh keep updating soft-deleted listings; the home-page "Refresh all" only touches active listings.

---

## Backlog 💡

Grouped by priority. Add new items under whichever group fits.

### High — meaningful gaps for daily use

- Email notifications when a family member adds a listing or comments
- Manual entry (no source URL) for sites we don't parse
- Bulk-apply labels (select many → apply one)

### Medium — useful enhancements without urgency

- Map view clustering with hover-card preview
- Background photo rehosting with streaming progress
- Thumbnails (smaller image variant) for index cards
- Browser bookmarklet for sites we can't scrape from Vercel

### Low — operational hardening / nice-to-haves

- Make R2 photo keys unguessable (random ULIDs)
- Migrate from `drizzle-kit push` to migration files + GitHub Actions
- PDF / shareable export

### Evaluate later — third-party integrations

- Clerk APIKeys (per-user / per-machine API keys)
- Google Places API for broader school coverage
- Google Places API as a neighborhood fallback when a listing's source page doesn't expose it (seam already in `resolve-neighborhood.ts`)
- GreatSchools API directly (fresher rating data)
- `next-intl` with explicit `en` / `pt-BR` catalogs as a polished replacement for the Google Translate widget — every UI string moves into per-locale JSON, URLs become `/en/...` and `/pt-BR/...`, no third-party banner, no React-reconciliation interference. Worth doing if the widget gets annoying or if we need translation-aware emails / non-browser surfaces.

---

See [FEATURES.md](./FEATURES.md) for per-slice technical detail and engineering notes.
