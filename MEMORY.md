# Project Memory

Running log of key decisions and **open topics**, so future sessions (and
agents) can pick up where we left off. Architecture/conventions live in
`AGENTS.md`; local setup + DB workflow in `docs/local-dev.md`. This file is the
"why / what's pending" companion.

_Last updated: June 2026._

---

## Open topics / TODO (start here)

- **Parser price misfire — `1431 S Halsted`.** A sale price was parsed as
  monthly rent (`$3,200 → $452,800/mo`). Fix the parser for that case **and**
  add a general **price sanity guard** (reject/flag implausible monthly rents,
  e.g. `> ~$25k`, or when the source signals a sale) → route into the
  scrape-health surface. Highest-priority correctness item.
- **WhatsApp digest reliability.** The daily digest uses the **Twilio WhatsApp
  Sandbox**, which only allows free-form messages within 24h of the recipient's
  last inbound message — so scheduled digests to WhatsApp can be silently
  dropped. **Telegram is the dependable channel.** For reliable WhatsApp, move
  to a production sender + a Meta-approved utility template.
- **Icon consistency (pending decision).** Per-listing actions are now icons
  (delete/share/edit/source). Still labeled, by choice: the bulk action bar
  ("Move to Trash") and the trash page's **Restore** / **Permanent delete**
  (destructive — labels arguably safer). Decide whether to iconify these too.
- **Feature backlog (not started):**
  - **Amenities** extraction (parking/pets/laundry — partly in source JSON) +
    display + filter. Highest feature value for the core use case.
  - **Optimize scraped photos** too (extend the `sharp` pipeline in
    `rehost-photos.ts`; currently only manual uploads are optimized).
  - **Composite "fit score"** ranking (price + safety + commute + schools).
  - **Comment/reaction notifications** to Telegram (reuse `src/lib/notify`).
  - **Persist list filters** in the URL (they reset on reload; also shareable).
- **Prod verification still worth doing** (after the `sharp` fix): manual photo
  upload, add-photos-from-URL, and WhatsApp share all exercise `sharp`/native
  paths that previously failed.

---

## Key decisions & lessons (don't relitigate)

### Deploy / infra (these caused real outages — see `docs/local-dev.md`)
- **DB schema changes use Drizzle migrations applied on deploy** (`build` =
  `drizzle-kit migrate && next build`), baselined on prod+dev. **Don't
  `db:push` to prod** — it bypasses the migration journal. `db:push:prod` is an
  emergency escape hatch only; env targeting via `DRIZZLE_ENV_FILE`.
- **`sharp` must not be imported into a render route** (it broke listing detail
  in the prod bundle). Keep it confined to `photo-store.ts`; render routes
  import sharp-free helpers (`manual-source.ts`). **Pin `sharp` to Next's
  bundled version (`0.34.5`)** — a second version caused a libvips load failure
  on Vercel.
- **`next dev` ≠ the prod build.** Reproduce prod-class bugs with
  `npm run preview` (`next build && next start`) or a Vercel preview. A failed
  Vercel build silently keeps the previous deployment live — verify the
  Production deployment's commit.
- **Middleware lives at `src/middleware.ts`** (Next 16 + a `src/` dir requires
  it there; root is ignored by local dev).
- **Local dev:** prod uses Clerk `pk_live` (domain-locked, no localhost); local
  uses the Clerk **Development** instance (`pk_test`). Point local `DATABASE_URL`
  at a **Neon branch**, never prod; re-scope rows to your dev Clerk org to see
  data (`scripts/rescope-local.sql`).

### Product / behavior
- **Nightly cron intentionally refreshes trashed listings** too (to keep
  tracking changes while they sit in the trash). Don't "fix" it.
- **Comments & reactions are allowed on trashed listings** (the team can keep
  discussing after trashing); edit/delete stay gated to active listings.
- **Possible-duplicate detection is soft** (a hint, never blocks): matches by
  normalized street address (primary) + coordinate proximity (secondary).
- Prefer **live scrape-health monitoring** (digest surfaces `lastCheckError` +
  `parse_empty`) over frozen-fixture parser tests — fixtures can't catch the
  dominant failure (a site changing its HTML).

### Shipped this period (June 2026)
- Fixed Zillow building-page availability ("no available units").
- **Contact status** (contacted/visited/applied/discarded) + filter.
- **Comment-count** indicator; **possible-duplicate** "Dup?" badge + banner.
- **Manual listing** creation (admin) with device photo upload + "use my
  current location" geocoding.
- **Photo optimization** (sharp → WebP + thumbnail; `thumb_r2_key`); **add
  photos to existing listings** from files or URLs (detail page).
- **Daily digest** (Telegram + Twilio WhatsApp) with scrape-health section,
  admin "test digest" trigger, and notify-on-manual-refresh.
- New site parser: **Fulton Grace** (`fultongrace.com`).
- UI: dropped "P" priority prefix; merged neighborhood+district into one
  **"Area"** table column; **click-to-select rows** (reddish highlight)
  replacing checkboxes in table/list (cards keep checkbox); **compare view**
  (select 2–4 → side-by-side modal); **WhatsApp share** (in-app link only) as
  an icon everywhere; **delete → trash icon**; fully icon-based detail action
  row; wrapping action-icon cluster in list rows; **PWA** (manifest, icons,
  service worker).
