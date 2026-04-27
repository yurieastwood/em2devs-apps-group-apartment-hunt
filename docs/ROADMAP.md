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

---

## Backlog 💡

Grouped by priority. Add new items under whichever group fits.

### High — meaningful gaps for daily use

- Advanced/Complex sorting; sort by multiple fields simultaneously, each adding on the sorting priority.
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
- GreatSchools API directly (fresher rating data)

---

See [FEATURES.md](./FEATURES.md) for per-slice technical detail and engineering notes.
