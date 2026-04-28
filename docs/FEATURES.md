# Apartment Hunt — Features (technical detail)

How each feature was built — file paths, schema, libraries, decisions. For a high-level slice list see [ROADMAP.md](./ROADMAP.md).

## Stack & cross-cutting decisions

- **Frontend & API**: Next.js 16 (App Router, src dir) + TypeScript + Tailwind v4
- **Database**: Neon Postgres (serverless) + Drizzle ORM (HTTP driver)
- **Auth**: Clerk — currently the Development instance; Production instance once a custom-domain DNS verification is in place
- **Object storage**: Cloudflare R2 (S3-compatible)
- **Hosting**: Vercel (Hobby tier; custom domain bound)
- **Listing scraping**: `curl-impersonate` (Chrome / Firefox profiles) bundled with the serverless function — TLS fingerprint defeats PerimeterX
- **Architecture**: Vertical Slices + Clean Code; Conventional Commits

---

## Slice 0 — Infrastructure

Project foundations and account wiring.

- Next.js scaffold (TypeScript, Tailwind, ESLint, App Router, src dir, `@/*` import alias).
- Drizzle ORM + `@neondatabase/serverless` client, lazy-initialized via a Proxy so build doesn't need `DATABASE_URL`.
- Clerk middleware (`auth.protect()`), `<ClerkProvider>` in root layout, sign-in / sign-up catch-all routes.
- Cloudflare R2 module (`putObject`, `urlFor`, `deleteObjects`).
- `.env.local.example` documenting all required env vars; Vercel env vars wired.
- GitHub repo + Vercel auto-deploy on push to `main`.
- Custom domain (`group-apartment-hunt.xyz`) bound to Vercel.

## Slice 1 — Listing-from-URL

Paste a source URL → a structured listing with rehosted photos.

- **Bundled scraper**: `curl-impersonate` Linux x86_64 binary; `outputFileTracingIncludes` ships it with every server route.
- **Health endpoint**: `/api/health/scrape` (de-risk: verify TLS-impersonated fetches pass from Vercel IPs).
- **Multi-profile retry per host** (`profileCandidates`) — handles profile drift as bot rules update.
- **Schema**: `listings` + `listing_photos` with cascade delete and indexes.
- **Zillow parser**: JSON-LD (Schema.org `RealEstateListing`) + `__NEXT_DATA__.gdpClientCache.property`.
- **Apartments.com parser**: JSON-LD `@graph[0].mainEntity` + the inline `ProfileStartup({ rentals: [...] })` block for beds / baths / sqft.
- **ApartmentList parser**: JSON-LD `Apartment` block for beds/baths + `__NEXT_DATA__.props.pageProps.component.listing` for address, geo, price, sqft, description, and `all_photos[].id` (Cloudinary asset ids → reconstructed via `f_auto,q_auto` transform). Multi-unit listings pick a single floor plan and source bed / bath / price / sqft from it consistently.
- **Photo rehoster**: plain `fetch()` first (Zillow CDN), `curl-impersonate` fallback (Apartments.com / Akamai); batches of 4 in parallel.
- **`createListingFromUrl` orchestrator**: validate URL → dedup → fetch → parse → insert listing → rehost photos → insert photo rows.
- **Paste-URL form** (`/listings/new`) with `useFormStatus` progress UI: spinner + "10–15 seconds — please don't close this tab".
- **Detail page** (`/listings/[id]`) with embla photo carousel + yet-another-react-lightbox fullscreen viewer; single-slide lightbox suppresses prev/next buttons and disables wrap-around keyboard nav.
- **Photo rehost-error surfacing**: failures recorded in `listings.raw.photoErrors`; collapsible diagnostic block on detail page.

## Slice 2 — Browse + Manage + Engage

Find, edit, react to and comment on saved listings.

- **Browse index at `/`** — cards with cover photo, address, beds/baths/sqft/price; sorted newest first.
- **Cards / List view toggle** persisted via cookie (no flicker on first paint); list view's "Show photo" opens the cover in a lightbox modal.
- **Owner-only Delete listing** on detail page (confirm dialog, scoped query, R2 batch cleanup).
- **Owner-only Edit listing** form (`/listings/[id]/edit`) — same form doubles as manual-correction for bad extractions.
- **Comments + reactions** schema (`comments`, `reactions`) with cascade delete.
- **Comments UI** on detail page — post + thread, author avatar/name from Clerk (batched `getUserList` for unique authors), owner-only delete.
- **Reactions UI** on detail page — fixed emoji set (❤️ 👍 🔥 😍 🤔 👎), click to toggle, count + your-own-reaction highlighted.
- **Home-page map** — Google Maps via `@vis.gl/react-google-maps` (swapped from the initial OpenStreetMap + Leaflet impl). Renders the user's home as a 🏠 emoji marker and listings as default blue pins; click a listing pin to open an InfoWindow with a link to its detail page. Auto-fits bounds to include all positions. The provider boundary is one file (`home-map.tsx` dynamic-imports `home-map-google.tsx`); to switch providers again, write a sibling impl with the same prop shape and change the import. Geocoding for the user's home address still uses Nominatim (free, no API budget).
- **Nearby schools** — parsed directly from each listing's source page during import (Zillow's `property.schools`, Apartments.com's school cards, ApartmentList's `component.schools`). Stored per listing in `listing_schools`. Detail page renders school name → GreatSchools link, type (Public/Charter/Private/Magnet), grade range, distance ("0.3 mi away") or "Attendance zone" indicator, and a color-coded rating badge (red 1-3 / yellow 4-6 / green 7-10).
- **Schools filter + sort UI on detail page** — client-side controls for sort (nearest / farthest / highest / lowest rating / name), filter chips for type, grade band (PK / K / Elementary / Middle / High — derived by parsing each school's grade-range string and computing band overlap), and minimum rating threshold.
- **Home-page listings browser** — sort by newest / oldest / price / most beds / most baths / nearest PK school rating. Filter chips for min beds / baths, max price, and min PK-school rating. Each listing's "nearest PK school rating" is derived server-side: filter `listing_schools` to grade ranges starting with PK, then per listing pick the row with the smallest `distance_miles` (tie-broken by `sort_order`) and use its rating.
- **Inline delete on home-page cards / list rows** — owner-only "Delete" button on each item. Shared `DeleteListingButton` is used by both the home page (no navigation, page revalidates and the row disappears) and the detail page (navigates to `/` after the action). The action no longer redirects; callers decide.
- **InfoWindow theming**: Google Maps InfoWindow chrome themed via global CSS overrides on `.gm-style-iw-c`, `.gm-style-iw-d`, `.gm-style-iw-tc::after`, and `.gm-ui-hover-effect > span` so dark mode is readable.

## Slice 2.5 — Bulk import

- **Bulk import** — second tab on `/listings/new?mode=bulk` (single-URL is the default tab). Paste URLs as plain text or HTML with anchors; supported-host URLs are auto-extracted (regex match + URL parse + supported-host filter, deduped). Client buckets URLs by host and runs a per-host worker pool (default 2 in flight per host, with a 0–500 ms random stagger before each request) calling `importListingAction` per URL. Per-row status (pending → processing → done/failed) updates as each worker finishes. Reuses `createListingFromUrl` end-to-end so dedup, parsing, and photo rehosting work the same as single-add. The `PER_HOST_CONCURRENCY` constant in `import-form.tsx` is the only knob — bumping past 3 starts risking PerimeterX blocks on Zillow specifically.

## Slice 2.6 — Auth-gated health endpoint

- **Auth gate** on `/api/health/scrape`: accepts either a signed-in Clerk session OR an `Authorization: Bearer <HEALTH_AUTH_TOKEN>` header. Anything else returns `401` with `WWW-Authenticate: Bearer realm="health"`. Constant-time comparison (`crypto.timingSafeEqual`) on the token. The route stays in the public middleware matcher so the Bearer path can reach the handler; auth happens inside the handler.

## Slice 2.7 — Points of interest with transit distances

POIs (Work, school, family) with transit-based distance to every listing.

- **Schema**: `points_of_interest` (label + address + lat/lng) and `listing_poi_distances` (cached transit duration + distance per (listing, poi)).
- **POI CRUD UI** in the home-page settings area: list, add, inline edit, delete. Address geocoded via Nominatim and stored as lat/lng.
- **Map markers**: green AdvancedMarker Pin per POI, alongside the 🏠 home marker and blue listing pins. Auto-fit bounds include POI positions. InfoWindow on click.
- **Google Distance Matrix integration** (server-side, mode=transit, `departure_time=now`). Separate `GOOGLE_MAPS_SERVER_KEY` env var (the public Maps JS key won't work server-to-server because of HTTP-referrer restrictions). Eager compute on POI add (POI × all listings) and on listing add (new listing × all POIs); results cached in `listing_poi_distances` so subsequent renders don't pay the API cost.
- **Display**: home cards/rows show "🚌 Work: 25 min" per POI under the BR/BA/price line; listing detail page renders a "Transit times" section listing each POI with duration + miles. Pure formatters in `src/lib/transit-format.ts` so server and client components can share them.

## Slice 3 — Access control

Family-scoped visibility via Clerk Organizations.

- **R2 public bucket binding + `R2_PUBLIC_URL_BASE`** — replace per-photo presigned URLs with direct URLs (faster page loads, no S3 SDK calls per render). Includes a fix to `urlFor()` to encode key segments individually so path slashes survive.
- **Clerk Organizations integration** — `<OrganizationSwitcher />` in the app header; `org_id` column on `listings` (nullable for personal-mode legacy rows); reads/writes scoped via `listingScope` helper (in an org → filter by `org_id`; personal → owner-and-`org_id`-IS-NULL); detail page, edit page, and all mutating actions (delete, edit, comment, reaction) gate access via `userCanAccessListing`. Comments and reactions inherit visibility from their parent listing's scope.
- **Home address + points-of-interest are also org-scoped** — replaced the per-user `user_settings` table with a scope-aware `home_settings` table (one shared home per org, or per-user in personal mode); `points_of_interest` gains `org_id` so POIs are now shared across the family. POI distance fan-out is scope-aware too: when a member adds a POI, distances are computed against listings in the same scope.

Still planned: a backfill UI for moving pre-orgs personal listings into an active org (today the user runs SQL); disabling public sign-up in Clerk so only invited members can join.

## Slice 3.7 — Customizable POI pin colors

Per-POI pin color pickable from a fixed palette, rendered via Google's `<Pin>` so it stays pixel-identical across platforms.

- **Schema**: `points_of_interest.color` (text, nullable). Null = default green so legacy rows render unchanged.
- **Palette** (`src/lib/poi-pin-color.ts`): 8 named colors (green, blue, red, amber, purple, pink, teal, gray), each with `background` / `border` / `glyph` hex codes that feed Google's Pin props directly. `poiPinColor(name)` looks up by name with a green fallback; `isValidPoiColorName(name)` is used by the action layer to whitelist input.
- **Form**: shared `<PoiColorPicker>` client component renders 8 round swatches with a hidden `name="color"` input. Selection scales the swatch and outlines it. Used by both the Add POI form and the inline edit form on each POI row.
- **Actions**: `addPoiAction` and `updatePoiAction` read `color` via a `readPoiColor` helper that validates against the palette before persisting; unknown values become null.
- **Map** (`home-map-google.tsx`): `<PoiMarker>` resolves the color via `poiPinColor()` and passes `background` / `borderColor` / `glyphColor` to `<Pin>`. Same component is reused on the listing detail page.
- **Inline display**: each POI row in the home settings shows a small filled circle in the chosen color before the label, so the picker's effect is visible without scrolling to the map.

## Slice 3.6 — Role-based access (admins vs members)

Two-tier permissions on top of Clerk Organizations. The org creator is `org:admin` automatically; invitees default to `org:member`. Roles are managed from Clerk's `<OrganizationProfile />` UI (no extra UI built here).

- **Helper** (`src/lib/auth/roles.ts`): `isOrgAdmin()` reads `auth().has({ role: "org:admin" })`. Personal-mode (no active org) returns false — treated as non-admin.
- **Server-action gates (admins only)**: `createListingAction` + `importListingAction`, `updateListingAction`, `setHomeAction`, `addPoiAction`, `updatePoiAction`, `deletePoiAction`, `refreshAllListingsAction`. Each returns an error state for non-admins ("Admins only — ask an admin to …").
- **Server-action gates (admin OR original author)**: `deleteListingAction` and `deleteCommentAction`. Members can still remove their own; admins can remove anyone's.
- **Open to everyone in the family**: comment/reaction add, single-listing `refreshListingAction`, `setListingPriorityAction`, label apply/unapply (apply uses scope-level labels).
- **Page-level redirects**: `/listings/new` and `/listings/[id]/edit` `redirect("/")` (or back to the detail page) for non-admins, so deep links don't leave a non-admin staring at a form whose submit will fail.
- **UI gating**:
  - Home page: `<HomeSettingsForm>` swapped for a read-only "Your home: …" line for members; `<PoisSection canEdit={isAdmin}>` hides Add/Edit/Delete buttons; "Add a listing" link, "Refresh all" button, and the empty-state CTA only render for admins (members see "Ask an admin to add one").
  - Detail page: Edit link is admin-only; Delete is admin OR owner. Comments delete is admin OR comment author.
  - Card / list rows: `canDelete` (admin OR listing owner) replaces the old `isOwner` field on `HomeListingItem`.
- **Invites**: handled by Clerk's built-in `<OrganizationProfile />` (reachable from `<OrganizationSwitcher />`). Default Clerk permissions only let `org:admin` invite, so no extra wiring needed.

## Slice 3.5 — Refresh + change log

Daily cron and on-demand re-scraping with a per-field audit trail.

- **Schema**: `listings` gains `availability` (text — `available` / `unavailable` / `unknown`, default `unknown`), `last_checked_at` (timestamptz, nullable), `last_check_error` (text, nullable). New `listing_changes` table — `id`, `listing_id` (cascade), `field`, `old_value`, `new_value`, `source` (`cron` / `manual`), `changed_at` — with indexes `(listing_id, changed_at)` and `(changed_at)`.
- **Parsers**: each parser returns `availability` alongside the existing fields. Zillow reads `homeStatus` (`FOR_RENT` → available; `RECENTLY_RENTED` / `OFF_MARKET` / `PENDING` → unavailable). Apartments.com reads `offers.availability` JSON-LD (`InStock` / `OutOfStock`) with a fallback regex on the page body. ApartmentList checks `listing.is_active` and the count of `available_units` with non-zero price.
- **Refresh lib** (`src/lib/listings/refresh.ts`): `refreshListing(id, source)` re-fetches via the existing multi-profile `fetchListing`, diffs price + availability against the current row, inserts one `listing_changes` row per change, then updates the listing + `last_checked_at`. HTTP 404 on the source URL is treated as a strong "gone" signal — flips availability to `unavailable` even though the parser couldn't run. Other non-200 statuses (5xx, anti-bot 403) just record `last_check_error` without changing availability. `refreshListingsBatch(ids, source, concurrency=4)` runs them in parallel batches of 4 (matches the photo rehoster) so the 300 s function ceiling holds ~100 listings per invocation.
- **Server actions** (`refresh-actions.ts`): `refreshListingAction(id)` verifies family scope via `userCanAccessListing`. `refreshAllListingsAction()` iterates everything in the active scope. Both revalidate `/` and the detail-page route after running.
- **Cron route** (`/api/cron/refresh-listings`): bearer-authed against `CRON_SECRET`, runs across **all** listings (no scope — the cron is system-level). 300 s `maxDuration`. Listed in the public middleware matcher so the bearer check inside the handler can run. Vercel adds the `Authorization` header automatically based on `vercel.json` cron config.
- **Cron schedule** (`vercel.json`): `0 6 * * *` daily at 06:00 UTC.
- **Detail page**: header gains an availability badge (green/red), a "Last checked …" timestamp, and a "Refresh now" button (client component, server action). Below the comments is a collapsible `<ListingChangesLog>` showing the latest 50 changes with field, before → after, timestamp, and source.
- **Home page**: `<RecentChangesBanner>` collapses 24-hour activity into a single banner above the listings; `<RefreshAllButton>` next to the view-mode toggle; `<AuditSizeWarning>` shows when `listing_changes` exceeds 5,000 rows. The browser gains a "Hide unavailable" filter chip and a small "Unavailable" badge on cards and list rows. `availability` flows through `HomeListingItem`.
- **React purity rule workaround**: the recent-changes data fetch lives in a non-component helper (`getRecentChanges`) so the `Date.now()` window calculation doesn't trip `react-hooks/purity` (which only flags components and hooks).

## Slice 3.4 — Multi-field sort

Tiered sort across any combination of structured fields on the home-page browser.

- **State** (`src/components/listings-browser.tsx`): `sortCriteria: SortCriterion[]` where each criterion is `{ field, direction }`. Fields: `priority`, `createdAt`, `price`, `beds`, `baths`, `sqft`, `pkRating`. Default state is `[{ field: "priority", direction: "asc" }]`.
- **Comparator**: `compareWithCriteria` walks the criteria in order; first non-zero `compareCriterion` result wins. `compareCriterion` extracts the field via `fieldValue` (returns a `number | null`) and treats nulls as last regardless of direction, so unprioritized listings always trail prioritized ones even when the column is sorted descending.
- **UI**: `<SortBuilder>` renders one `<SortChip>` per criterion plus a "+ Add field" select that lists only fields not yet used. Each chip shows the field label, an arrow indicating direction (clicking the label toggles asc/desc), `‹`/`›` buttons to swap with neighbors (disabled at the ends), and `×` to remove. Removing the last criterion replaces with `DEFAULT_SORT` so the list is never empty.
- The previous single `<select>` of preset sort options is gone; `priority` ascending stays the default behavior.

## Slice 3.3 — Listing priority

A contiguous 1..N priority within each scope (org or personal). Anyone in the family can change it; setting one slot shifts the others to keep the sequence packed.

- **Schema**: nullable `priority` integer column on `listings`. NULL = unprioritized; existing rows on push stay NULL.
- **Reorder logic** (`src/lib/listings/priority.ts`):
  - `null → P`: shift everything `>= P` up by one, then set the target.
  - `P → null`: shift everything `> P` down by one, then null the target.
  - `P_old → P_new` (smaller): shift the range `[P_new, P_old)` up by one.
  - `P_old → P_new` (larger): shift the range `(P_old, P_new]` down by one.
  - Validates `P` is in `[1, prioritizedCount + (1 if adding else 0)]` before any write.
- **Delete cleanup**: `shiftPrioritiesAfterDelete` reduces every priority `>` the removed slot, called from `deleteListingAction` after a successful delete.
- **Action**: `setListingPriorityAction(listingId, newPriority | null)` reads scope from `auth()`, calls the lib, revalidates `/` and `/listings/[id]`. Anyone in the family can call it (no owner check).
- **UI**: a single `<PriorityEditor>` client component is the editor and the display. Inline number input (with "P" prefix) on home cards, list rows, and the detail page header. Empty value clears the priority. Parent re-keys the editor on `(listingId, priority)` so a server-side reorder forces a fresh `useState` init when the row's priority changes.
- **Sort**: new "Priority" option in the home-page sort dropdown, set as the default. Listings without a priority sort last (tied items break by `createdAt` newest-first).

## Slice 3.2 — Detail-page map

Reuses the home-page `<HomeMap>` component on `/listings/[id]`.

- Renders between the schools section and comments section, gated on the listing having `latitude` + `longitude`.
- Props: `home={null}` (the user's actual home is not shown here), `pins=[<single listing pin>]` (default blue marker labeled with the listing's address), `pois=<scope POIs>` (green markers, same as on the home page).
- Auto-fits bounds to include the listing + every POI; with no POIs, it centers on the listing at zoom 14 (the FitBounds child handles the single-position case).
- POIs come from `getPois({ userId, orgId })`, the same scope-aware fetch the home page uses, so family POIs are visible to every member.

## Slice 3.1 — Tags / labels

User-defined labels for organizing the hunt.

- **Schema**: `labels` (id, owner_clerk_user_id, org_id nullable, name, color, created_at; unique by scope+name) and `listing_labels` join (composite PK on listing_id + label_id, cascade-deletes).
- **Lib + actions**: CRUD in `src/lib/listings/labels{,-actions}.ts`. Labels live in the same scope as listings (org or personal).
- **Detail-page editor** (`<ListingLabelsSection>` + `<LabelsEditor>`): chip per applied label with × to remove, "+ Add label" opens a picker showing unapplied scope labels, "+ New label" inline form (name + 8-color palette).
- **Home page**: each card / list row renders the listing's labels as colored chips; controls bar gains a labels filter chip group (multi-select with OR semantics — a listing matches if it has any of the selected labels).

---

## Cross-cutting work

- **Theme**: semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`) — dark mode auto-flips via CSS vars on `prefers-color-scheme`.
- **Layout**: shared `<AppHeader>` with brand link, "Add listing" link, Clerk `<OrganizationSwitcher />` and `<UserButton />` (rendered only when signed in).
- **Privacy**: `app/robots.ts` disallows all crawlers; root metadata sets `noindex/nofollow`; `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` response header on every route.

## Engineering notes

- **Bot-detection volatility**: PerimeterX rules and IP-reputation lists drift faster than we can hand-tune. Architecture uses a ranked candidate list per host with first-success retry. As of 2026-04-25: `chrome145` for Zillow, `firefox147` for Apartments.com.
- **No transactions**: `drizzle-orm/neon-http` is HTTP-based; transactions aren't supported. Failure modes that leave partial state (listing without all photos, R2 objects without DB rows) are acceptable for MVP and recoverable.
- **Schema changes**: run `npm run db:push` from a developer's Mac with `DATABASE_URL` in `.env.local`. Drizzle-kit connects to Neon over the network — there is no local DB.
- **Vercel function limits (Hobby)**: 60 s `maxDuration`; the create action takes ~10–15 s for a 26-photo listing.
- **Sandbox / Mac platform mismatch**: this repo's `node_modules` is shared between the Linux sandbox and the user's Mac. Run `npm install` on the Mac after pulling changes that added or updated deps; otherwise platform-specific binaries (esbuild, swc) only have one of the two architectures and tools fail with "wrong platform" errors.
