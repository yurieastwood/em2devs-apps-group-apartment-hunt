# Local development

How to run the app locally **safely** (isolated from prod) and **faithfully**
(with prod-like data), plus how to catch production-only bugs before deploying.

## Why local needs care

- **Clerk:** production uses a `pk_live` (Production) instance, which is
  domain-locked and **cannot run on `localhost`**. Local must use the
  **Development** instance keys (`pk_test_` / `sk_test_`). Your local Clerk
  user/org ids therefore differ from prod.
- **Data scoping:** `listings`, `points_of_interest`, `labels`, and
  `home_settings` are scoped by `org_id` / `owner_clerk_user_id`. So a local
  (dev-instance) login won't see rows owned by your prod (live-instance) ids
  until they're re-scoped.
- **Never point local at the prod database** — local writes would hit prod.

## One-time setup

1. **Database — use a Neon branch, not prod.**
   In Neon, create a branch of prod (copy-on-write, instant, includes data).
   Put the branch's connection string in `.env.local` as `DATABASE_URL`.

2. **Clerk — Development instance keys** in `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
   (Clerk dashboard → switch to **Development** → API keys.)

3. **Fill in the rest of `.env.local`** — `R2_*`, `GOOGLE_MAPS_*`, etc. (copy
   from Vercel). Digest/cron vars are optional locally. See `.env.example`.

4. **Sign in & make an org.** Sign up locally (Clerk dev test trick: email
   `you+clerk_test@example.com`, verification code `424242`). If your data is
   org-scoped, create an organization (you become `org:admin`).

## Refresh local data from prod

A Neon branch is a point-in-time copy and drifts over time.

- **Get current prod data + schema:** Neon → Branches → your branch →
  **Reset from parent** (re-copies current prod, instant). This overwrites
  branch edits, so re-run the re-scope afterward.
- **Schema only out of sync** (older branch missing columns → query 500s):
  `npm run db:push` against the branch.

After refreshing, re-point the data to your dev identity so you can see it:

```
psql "$DATABASE_URL" -f scripts/rescope-local.sql   # fill in placeholders first
```

## Running

| Command | Use |
|---------|-----|
| `npm run dev` | Fast iteration (Turbopack). **Not** representative of the prod build. |
| `npm run preview` | `next build && next start` — bundles/runs like prod. |

> ⚠️ `next dev` ≠ the Vercel production build. Some bugs only appear when built
> (e.g. a native module like `sharp` pulled into a route's serverless bundle, or
> middleware resolution). **Reproduce prod-class issues with `npm run preview`
> or a Vercel preview deployment**, not `npm run dev` alone.

## When prod breaks but local doesn't

1. Confirm the **Production** deployment is the commit you expect — a failed
   Vercel build silently leaves the previous deployment live.
2. Reproduce with `npm run preview` (closest local equivalent to prod).
3. Get the real error from **Vercel → Logs** (or the server-component
   `digest` shown in the browser console) — the production page hides details.
