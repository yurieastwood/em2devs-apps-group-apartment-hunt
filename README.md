# Apartment Hunt

Private, collaborative apartment-hunting web app. Families and teams share a workspace, import rental listings from Zillow, Apartments.com, and ApartmentList via URL, then jointly analyze, comment on, and prioritize them. Enriched with nearby schools, transit times to user-defined points of interest, and a per-listing safety score from Chicago crime data.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open <http://localhost:3000>.

Required env vars (see [AGENTS.md](./AGENTS.md#environment-variables) for the full table and optional vars):

- `DATABASE_URL` — Neon Postgres
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk auth
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 photo storage
- `GOOGLE_MAPS_SERVER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Maps + Distance Matrix
- `CRON_SECRET`, `HEALTH_AUTH_TOKEN` — Bearer tokens for `/api/cron/*` and `/api/health/*`

## Database

```bash
npm run db:generate    # after editing src/db/schema.ts
npm run db:migrate     # apply migrations
```

## More

- [AGENTS.md](./AGENTS.md) — architecture, conventions, scraping, safety scoring, multi-tenancy model. Read this before making changes.

## License

[AGPL-3.0-or-later](./LICENSE).
