# Rismon

Rismon is a hosted, multi-user AI learning tutor (deployed on Vercel at [rismon.ai](https://rismon.ai)) that helps learners master any subject through personalized lessons, practice and spaced revision — where deterministic code, not the AI, validates every answer and owns the learner's mastery state.

## Prerequisites

- **Node.js 24 LTS** (major pinned by `engines` in `package.json`; exact version in `.nvmrc`)
- **pnpm** (version pinned by `packageManager` in `package.json` — install with `corepack enable pnpm`, or `npm install -g pnpm`)
- **Git**
- A **Supabase project** (for Auth + PostgreSQL). You need the URL, the anon/publishable key, the service/secret key (test helpers only) and two Postgres connection strings.

All commands are for **PowerShell** and are run from the repository root.

## Install

```powershell
pnpm install
```

## Environment variables

Copy the variable names from `.env.example` into a local `.env.local` and fill in real values:

```powershell
Copy-Item .env.example .env.local
# then edit .env.local with your Supabase values — it is gitignored, never committed
```

`.env.local` holds secrets and is never committed, printed or logged. To check which variables are set **without** revealing values:

```powershell
pnpm check:env
```

Two database connection strings are used on purpose: `DATABASE_URL` (app runtime — the transaction pooler on Vercel) and `DATABASE_MIGRATION_URL` (session pooler, used by `drizzle-kit` only). See `docs/database.md`.

## Run (development)

```powershell
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at `http://localhost:3000/api/health`:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Stop the dev server with `Ctrl+C`.

## Test

```powershell
pnpm test
```

## Type check

```powershell
pnpm typecheck
```

## Build

```powershell
pnpm build
```

Start the production server with `pnpm start` after building.

## Lint

```powershell
pnpm lint
```

## Database (Drizzle migrations)

```powershell
pnpm db:generate   # writes a new SQL file under drizzle/ from src/server/db/schema.ts
# ...review the SQL...
pnpm db:migrate    # applies pending migrations using DATABASE_MIGRATION_URL
```

Migrations are generated from the Drizzle schema, reviewed by a human, then applied. Never edit the schema through the Supabase dashboard. See `docs/database.md`.

## Documentation

- `docs/architecture.md` — stack, auth flow and layer rules
- `docs/database.md` — tables, constraints, connection strings and the migration workflow
- `docs/design.md` — design tokens, fonts, components, brain performance rules
- `docs/development.md` — development workflow
- `AGENTS.md` — rules for AI agents working in this repository

## Public site (Milestone 2A)

- Marketing pages (`/`, `/vision`, `/beta`, `/contact`, `/privacy`, `/terms`) are
  Server Components using `src/components/ui` (Button, Badge, Container,
  Section, SiteHeader, SiteFooter) with tokens from `src/app/globals.css`
  (light/dark via `prefers-color-scheme`, no toggle yet).
- The home hero shows a 3D brain (`src/components/brain`): a deterministic
  point cloud rendered with React Three Fiber, loaded with `next/dynamic`
  (`ssr: false`) only on `/`, with a static SVG fallback when WebGL is
  unavailable. Company details in `src/config/site.ts` use the real values
  (Rismon.ai, from the house of Labs3am.com, hello@rismon.ai); only
  `[JURISDICTION]` is still a placeholder.
- `/privacy` and `/terms` are marked "DRAFT, pending review" and describe only
  what the app does today (Supabase accounts + database, Vercel hosting,
  essential auth cookies; no analytics, advertising or AI processing yet).
