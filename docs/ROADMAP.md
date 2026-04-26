# Apartment Hunt — Roadmap

A personal, family-scoped app for sharing apartment listings during a lease hunt.

## Stack & cross-cutting decisions

- **Frontend & API**: Next.js 16 (App Router, src dir) + TypeScript + Tailwind v4
- **Database**: Neon Postgres (serverless) + Drizzle ORM (HTTP driver)
- **Auth**: Clerk — currently the Development instance; Production instance once a custom-domain DNS verification is in place
- **Object storage**: Cloudflare R2 (S3-compatible)
- **Hosting**: Vercel (Hobby tier; custom domain bound)
- **Listing scraping**: `curl-impersonate` (Chrome / Firefox profiles) bundled with the serverless function — TLS fingerprint defeats PerimeterX
- **Architecture**: Vertical Slices + Clean Code; Conventional Commits

## Status legend

- ✅ Done and live
- 🔄 In progress
- 📋 Planned, not started
- 💡 Backlog / nice-to-have

---

## Slice 0 — Infrastructure ✅

Project foundations and account wiring.

- ✅ Next.js scaffold (TypeScript, Tailwind, ESLint, App Router, src dir, `@/*` import alias)
- ✅ Drizzle ORM + `@neondatabase/serverless` client (lazy-initialized via Proxy so build doesn't need `DATABASE_URL`)
- ✅ Clerk middleware (`auth.protect()`), `<ClerkProvider>` in root layout, sign-in / sign-up catch-all routes
- ✅ Cloudflare R2 module (`putObject`, `urlFor`, `deleteObjects`)
- ✅ `.env.local.example` documenting all required env vars; Vercel env vars wired
- ✅ GitHub repo + Vercel auto-deploy on push to `main`
- ✅ Custom domain (`group-apartment-hunt.xyz`) bound to Vercel

## Slice 1 — Listing-from-URL ✅

Paste a Zillow or Apartments.com URL → structured listing with rehosted photos.

- ✅ Bundle `curl-impersonate` Linux x86_64 binary; `outputFileTracingIncludes` ships it with every server route
- ✅ `/api/health/scrape` health endpoint (de-risk: verify TLS-impersonated fetches pass from Vercel IPs)
- ✅ Multi-profile retry per host (`profileCandidates`) — handles profile drift as bot rules update
- ✅ `listings` + `listing_photos` schema with cascade delete and indexes
- ✅ Zillow parser: JSON-LD (Schema.org `RealEstateListing`) + `__NEXT_DATA__.gdpClientCache.property`
- ✅ Apartments.com parser: JSON-LD `@graph[0].mainEntity` + the inline `ProfileStartup({ rentals: [...] })` block for beds/baths/sqft
- ✅ Photo rehoster: plain `fetch()` first (Zillow CDN), `curl-impersonate` fallback (Apartments.com / Akamai); batches of 4 in parallel
- ✅ `createListingFromUrl` orchestrator: validate URL → dedup → fetch → parse → insert listing → rehost photos → insert photo rows
- ✅ Paste-URL form (`/listings/new`) with `useFormStatus` progress UI: spinner + "10–15 seconds — please don't close this tab"
- ✅ Detail page (`/listings/[id]`) with embla photo carousel + yet-another-react-lightbox fullscreen viewer
- ✅ Photo rehost-error surfacing: failures recorded in `listings.raw.photoErrors`; collapsible diagnostic block on detail page

## Slice 2 — Browse + Manage + Engage ✅

Find, edit, react to and comment on saved listings.

- ✅ Browse index at `/` — cards with cover photo, address, beds/baths/price; sorted newest first
- ✅ Cards / List view toggle persisted via cookie (no flicker on first paint); list view's "Show photo" opens the cover in a lightbox modal
- ✅ Lightbox single-slide fix: hide prev/next buttons and disable wrap-around keyboard nav when there's only one photo
- ✅ Owner-only **Delete listing** on detail page (confirm dialog, scoped query, R2 batch cleanup)
- ✅ Owner-only **Edit listing** form (`/listings/[id]/edit`) — same form doubles as manual-correction for bad extractions
- ✅ `comments` + `reactions` tables (schema in place)
- ✅ Comments UI on detail page — post + thread, author avatar/name from Clerk, owner-only delete
- ✅ Reactions UI on detail page — fixed emoji set (❤️ 👍 🔥 😍 🤔 👎), click to toggle, count + your-own-reaction highlighted
- ✅ Home-page map — OpenStreetMap + Leaflet (provider-pluggable: swap `home-map.tsx` to load a different impl to switch to Mapbox or Google later). User home address geocoded via Nominatim, stored as lat/lng in `user_settings`. Map auto-fits to home + every listing's pin; click a listing pin to open its detail page.

## Slice 2.5 — Bulk import ✅

Quality-of-life addition between major slices.

- ✅ Bulk import — second tab on `/listings/new?mode=bulk` (single-URL is the default tab). Paste URLs as plain text or HTML with anchors; Zillow / Apartments.com URLs are auto-extracted (regex match + URL parse + supported-host filter, deduped). Client iterates the list calling `importListingAction` per URL, showing per-row status (pending → processing → done/failed). Reuses `createListingFromUrl` end-to-end so dedup, parsing, and photo rehosting work the same as single-add.

## Slice 2.6 — Auth-gated health endpoint ✅

Lock down the diagnostic so it's not a free public scraping endpoint.

- ✅ `/api/health/scrape` accepts either a signed-in Clerk session OR an `Authorization: Bearer <HEALTH_AUTH_TOKEN>` header. Anything else returns `401` with `WWW-Authenticate: Bearer realm="health"`. Constant-time comparison (`crypto.timingSafeEqual`) on the token. The route stays in the public middleware matcher so the Bearer path can reach the handler; auth happens inside the handler.

## Slice 3 — Access control 📋

Invite-only, family-scoped access.

- 📋 Clerk Organizations integration (one org per household/family; one user can be in multiple)
- 📋 Add `org_id` column to `listings`; backfill existing rows; scope all reads/writes to the current org
- 📋 Invite flow (create org from settings, invite family by email, accept-invite UI)
- 📋 Disable public sign-up in Clerk so only invited members can join
- 📋 R2 public bucket binding + `R2_PUBLIC_URL_BASE` env — replace per-photo presigned URLs with direct URLs (faster page loads, no S3 SDK calls per render)

## Backlog / future polish 💡

Not yet scoped to a slice; pull from this list when ready.

- Notifications when a family member adds a listing (email via Resend, or in-app)
- Manual entry (no source URL — just type fields) for sites we don't parse
- Tags / labels on listings ("favorite", "tour scheduled", "rejected", custom)
- Map view (cluster pins by city, hover to see card)
- Background photo rehosting + streaming progress so the create action returns instantly
- Thumbnails (smaller image variant) for index cards to reduce payload
- Migrate from `drizzle-kit push` to migration files + GitHub Actions on push (for production-grade schema evolution)
- Make R2 photo keys unguessable (random ULIDs instead of `<listing-id>/000.jpg`) for defense-in-depth
- Browser bookmarklet fallback for sites we can't scrape from Vercel IPs
- Export listing as PDF / shareable summary
- Evaluate Clerk's APIKeys product (per-user / per-machine API keys with server-side verification) once we have multiple machine clients or want to gate `/api/**` more granularly. Defer until post-MVP.

---

## Cross-cutting work landed alongside slices

- **Theme**: semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`) — dark mode auto-flips via CSS vars on `prefers-color-scheme`
- **Layout**: shared `<AppHeader>` with brand link, "Add listing" link, Clerk `<UserButton>` (rendered only when signed in)
- **Privacy**: `app/robots.ts` disallows all crawlers; root metadata sets `noindex/nofollow`; `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` response header on every route

## Key engineering notes

- **Bot-detection volatility**: PerimeterX rules and IP-reputation lists drift faster than we can hand-tune. Architecture uses a ranked candidate list per host with first-success retry. As of 2026-04-25: `chrome145` for Zillow, `firefox147` for Apartments.com.
- **No transactions**: `drizzle-orm/neon-http` is HTTP-based; transactions aren't supported. Failure modes that leave partial state (listing without all photos, R2 objects without DB rows) are acceptable for MVP and recoverable.
- **Schema changes**: run `npm run db:push` from a developer's Mac with `DATABASE_URL` in `.env.local`. Drizzle-kit connects to Neon over the network — there is no local DB.
- **Vercel function limits (Hobby)**: 60s `maxDuration`; the create action takes ~10–15s for a 26-photo listing.
- **Sandbox / Mac platform mismatch**: this repo's `node_modules` is shared between the Linux sandbox and the user's Mac. Run `npm install` on the Mac after pulling changes that added or updated deps; otherwise platform-specific binaries (esbuild, swc) only have one of the two architectures and tools fail with "wrong platform" errors.
