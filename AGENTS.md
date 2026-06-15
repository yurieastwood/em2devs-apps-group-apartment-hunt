<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project

Private, collaborative apartment-hunting web app. Families/teams share a workspace, import rental listings from Zillow, Apartments.com, ApartmentList, and Fulton Grace via URL, then jointly analyze, comment, and prioritize. Enrichment includes nearby schools (scraped from Apartments.com listing pages), transit times to user-defined points of interest, and a per-listing safety score from Chicago crime data.

License: AGPL-3.0-or-later. The app sets `noindex/nofollow` — do not introduce public/indexable surfaces.

# Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 (strict) |
| Database | Neon PostgreSQL via Drizzle ORM 0.45 |
| Auth | Clerk (`@clerk/nextjs` 7.x, org-level multi-tenancy) |
| Storage | Cloudflare R2 via AWS S3 SDK |
| Maps | `@vis.gl/react-google-maps` + Google Distance Matrix |
| Scraping | `bin/curl-impersonate` binary (anti-bot bypass) |
| Deploy | Vercel (with cron jobs) |

# Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Start prod | `npm start` |
| Lint | `npm run lint` |
| Type-check | `npx tsc --noEmit` |
| Generate migration | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |
| Push schema (dev only) | `npm run db:push` |
| Open Drizzle Studio | `npm run db:studio` |

# Source layout

- `src/app/` — App Router pages, layouts, and route handlers
  - `src/app/api/cron/refresh-listings/` — Vercel cron (Bearer-authed via `CRON_SECRET`)
  - `src/app/api/health/scrape/` — scrape-health probe (Bearer-authed via `HEALTH_AUTH_TOKEN`)
- `src/components/` — Reusable React components (kebab-case files, named exports, imported via `@/components/<name>`)
- `src/db/` — Drizzle `schema.ts` + Neon `client.ts`
- `src/lib/` — Business logic
  - `auth/` — role helpers (`isOrgAdmin`)
  - `extract/` — fetch + parse listings; `parsers/{zillow,apartments,apartmentlist,fultongrace}.ts`
  - `listings/` — listing lifecycle: create, refresh, trash, labels, priority, photo rehosting, access checks
  - `safety/` — Chicago crime scoring (`chicago.ts`)
  - `places/`, `storage/` — Google Places, R2 client
- `bin/curl-impersonate` — bundled binary used by the scraper
- `middleware.ts` — Clerk gate; public routes: `/sign-in`, `/sign-up`, `/api/health`, `/api/cron`

# Domain entities (`src/db/schema.ts`)

- `listings` — core apartment row (title, address, price, coords, priority, availability)
- `listingPhotos` — R2-hosted images per listing
- `listingSchools` — nearby schools parsed off the listing source
- `listingChanges` — audit log of field changes (price, availability, etc.)
- `comments`, `reactions` — per-listing team collaboration
- `labels`, `listingLabels` — M2M custom tags
- `pointsOfInterest` — user-defined locations (work, school, etc.)
- `listingPoiDistances` — transit time/distance from listing → POI
- `homeSettings` — user's "home" address for safety-score baseline

# Multi-tenancy & auth

- **Personal scope**: row has `owner_clerk_user_id` set and `org_id IS NULL`
- **Org scope**: row has `org_id = X`; all members of that org share its data
- **Roles** (Clerk): `org:admin` can add/refresh/delete; `org:member` can view/comment/react. Personal mode has no role concept — treat as non-admin for write-gated features (`src/lib/auth/roles.ts`).
- All access checks go through `src/lib/listings/access.ts`. Never query listings without scoping by user + org.

# Environment variables

Required:

| Var | Used for |
|-----|----------|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client |
| `CLERK_SECRET_KEY` | Clerk server |
| `R2_ACCOUNT_ID` | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | R2 credentials |
| `R2_BUCKET` | R2 bucket name |
| `GOOGLE_MAPS_SERVER_KEY` | Server-side Maps/Distance Matrix calls |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client-side maps |
| `CRON_SECRET` | Bearer token expected by `/api/cron/*` |
| `HEALTH_AUTH_TOKEN` | Bearer token expected by `/api/health/*` |

Optional:

| Var | Default / effect |
|-----|------------------|
| `R2_PUBLIC_URL_BASE` | If set, serve R2 objects from this base instead of signed URLs |
| `CURL_IMPERSONATE_BIN` | Path to curl-impersonate binary; defaults to bundled `bin/curl-impersonate` |
| `APP_BASE_URL` | Base URL linked from the daily digest message |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Enable the Telegram daily-digest channel |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_TO` | Enable the WhatsApp (Twilio) daily-digest channel; `TO` is comma-separated E.164 |

# Database workflow

Drizzle Kit drives migrations.

- **Schema change → migration**: edit `src/db/schema.ts`, then `npm run db:generate` to produce a SQL migration, review it, then `npm run db:migrate` to apply.
- **Use `db:push` only in throwaway dev databases**. It skips the migration file and syncs the schema directly — fine for prototyping, dangerous for shared/prod data.
- All tables are scoped by `owner_clerk_user_id` and/or `org_id`. New tables must follow the same scoping pattern.

# Scraping & background work

- Listings are fetched via `bin/curl-impersonate` with browser-profile rotation to evade bot detection (`src/lib/extract/fetch-listing.ts`).
- Per-site parsers in `src/lib/extract/parsers/{zillow,apartments,apartmentlist,fultongrace}.ts`. Sites change HTML often — when one breaks, fix the parser and add a regression scrape against the saved raw HTML.
- Refresh runs nightly via Vercel cron: `vercel.json` schedules `0 6 * * *` against `/api/cron/refresh-listings`. The endpoint requires `Authorization: Bearer $CRON_SECRET` (constant-time compared).
- Refreshes diff incoming fields against current values and write deltas to `listingChanges`.
- After the refresh, the cron sends a daily digest of the last 24h of `listingChanges` to any configured channel (Telegram, WhatsApp via Twilio) — see `src/lib/notify/`. It's a single shared digest (not per-org/owner), skipped when there are no changes, and failure-isolated so a notification error never fails the refresh.

# Safety scoring

Chicago-only crime dataset (`src/lib/safety/chicago.ts`). Three metrics, in order of preference:

1. **Home-relative** (primary on detail page): `100 × home_raw / (home_raw + listing_raw)`. 50 = same safety as home.
2. **Percentile rank within library** (primary on home/list when no home is set; fallback when listing is outside Chicago).
3. **Min-max scaled** within the user's collection (diagnostic).

If a listing's coordinates fall outside coverage, fall back to percentile.

# Conventions

- **Commits**: Conventional Commits with a scope. Types seen in this repo: `feat`, `fix`, `chore`, `ui`, `refactor`. Scopes match the area touched (`trash`, `safety`, `listings`, `zillow`, `locale`, etc.). Keep the subject lowercase, no trailing period.
- **Components**: kebab-case filenames in `src/components/`, named exports, import via `@/components/<name>`. Co-locate route-specific components inside the route folder (e.g. `src/app/listings/deleted/trash-row.tsx`).
- **Server actions** live alongside the feature in `src/lib/<area>/*-actions.ts` and are imported by client components.
- **No `any`** — strict TS is on. Prefer `unknown` + narrowing at boundaries.
- **No comments explaining WHAT** code does — only add a comment for non-obvious WHY.

# Testing

There is no test runner configured (no `npm test` script, no `*.test.*` / `*.spec.*` files). Verification today relies on:

- `npx tsc --noEmit` for type safety
- `npm run lint`
- Manual exercise of the dev server for UI changes

If you add a test framework, wire it into `package.json` scripts and update this file.
