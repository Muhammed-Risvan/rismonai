# Rismon.ai — Repository Discovery & Technical Audit

> Read-only audit. Only this file was created; no existing file was modified, and
> nothing was installed, committed, deployed, or run against the live database.
> Findings are based on reading the actual source and running the project's own
> non-destructive checks (`lint`, `typecheck`, `test`, `build`, `check:env`).
> Anything I could not verify is explicitly labelled **unknown / not verified**.

Audit date: 2026-10-12 · Branch: `main` @ `112a013` · Working tree has uncommitted changes (see §2).

---

## 1. Executive summary

Rismon.ai today is a **well-architected foundation**, not yet the mentoring product
the owner describes. What exists and works:

- A **Next.js 16 (App Router) + React 19 + TypeScript** application on Vercel,
  using **Supabase Auth** for accounts and **PostgreSQL (via Drizzle ORM)** for data.
- **Email + password sign-in** that works, with a clean, test-backed authorization
  model: identity comes only from the server-verified session
  (`requireLearner()` → `auth.getUser()`), never from the client.
- Two genuinely implemented, unit- and integration-tested data features:
  **learner profiles** (display name, timezone) and **goals** (create/read/update/
  status transitions, with a database-enforced "one active goal per learner" rule).
- A polished **public/marketing site** (`/`, `/vision`, `/beta`, `/contact`,
  `/privacy`, `/terms`, 404, robots, sitemap), a small **design system**
  (tokens + Tailwind v4 + components), and a **decorative 3D brain** hero
  (React Three Fiber) with deterministic, pure, tested geometry.

What does **not** exist yet — despite being described in the README and `/vision` —
is the entire learning engine: no **onboarding**, **ambition/capability selection**,
**diagnostic assessment**, **roadmap/learning path**, **lessons**, **exercises/
challenges/projects**, **mastery model**, **attempts/misconceptions history**,
**adaptive planner**, **SMART planning**, **AI integration** (no SDK installed),
**mastery-based gamification**, or in-app **data export/delete/reset**.

The pure domain-logic layer the architecture docs promise (`src/core` for mastery,
planner, revision) **does not exist on disk yet** — it is documented as a
"future milestone."

**Bottom line:** infrastructure, auth, data-access patterns, design system, and
the testing harness are high quality and should be reused almost unchanged. The
gap to the intended product is the whole "learning + mentoring" domain, which is
net-new work. The single most valuable reusable asset is the disciplined layering
(route → service → data → pure core) and the security posture (server-verified
identity + service-layer `learnerId` scoping + RLS).

**Conflict to resolve with the owner:** current copy/docs name **"networking
fundamentals"** as the first subject, whereas the stated direction names
**Cloud Security Engineer**. Also, the "one active goal per learner" DB invariant
may conflict with the long-term "multiple ambitions" vision (see §16).

---

## 2. Verified repository structure

```
rismonai/
├─ AGENTS.md                 # the only AI-agent instruction file (see §4)
├─ README.md                 # setup + docs index (aspirational product copy)
├─ package.json              # scripts + pinned deps (Node 24.x, pnpm 12.10.1)
├─ pnpm-lock.yaml            ├─ pnpm-workspace.yaml   # allowBuilds policy
├─ tsconfig.json             # strict; path alias "@/*" -> ./src/*
├─ next.config.ts            # cacheComponents + partialPrefetching; security headers
├─ drizzle.config.ts         # reads DATABASE_MIGRATION_URL from .env.local
├─ vitest.config.mts         # unit tests (excludes DB suite; aliases @ + server-only)
├─ vitest.db.config.mts      # DB integration only (sets ALLOW_DB_TESTS=true)
├─ eslint.config.mjs         # eslint-config-next (core-web-vitals + typescript)
├─ .env.example              # variable NAMES only (safe placeholders)
├─ .nvmrc (24.20.0) ├─ .gitignore ├─ .clineignore / .rooignore
├─ scripts/check-env.ts      # prints env var NAMES + set/missing (never values)
├─ docs/  architecture.md  database.md  design.md  development.md
├─ drizzle/  0000_flawless_lilandra.sql   # the single migration (+ RLS/revokes)
│           └─ meta/ 0000_snapshot.json  _journal.json
├─ src/
│  ├─ proxy.ts               # Next 16 "proxy" (replaces middleware.ts) - session refresh
│  ├─ config/site.ts         # public site/company constants + contactHref()
│  ├─ lib/                   # isomorphic helpers
│  │  ├─ supabase/client.ts  # createBrowserClient (client components)
│  │  ├─ supabase/server.ts  # createServerClient + next/headers (server only)
│  │  ├─ goals/transitions.ts# allowed goal status transitions (isomorphic, pure)
│  │  └─ timezone.ts         # isValidTimeZone() via Intl
│  ├─ server/                # auth, validation, services, data access, http, db
│  │  ├─ errors.ts           # Unauthenticated/NotFound/Conflict/InvalidTransition
│  │  ├─ auth/require-learner.ts   # getUser()-based identity
│  │  ├─ auth/sign-in-log.ts       # pure, secret-safe log-line helpers
│  │  ├─ validation/goals.ts  profile.ts     # Zod (strict)
│  │  ├─ http/dto.ts  route-errors.ts         # response shaping + error mapping
│  │  ├─ services/goals.ts  profile.ts        # business logic + authorization
│  │  ├─ data/goals.ts  profiles.ts           # all Drizzle queries
│  │  └─ db/schema.ts  client.ts  errors.ts    # Drizzle schema + lazy pg client
│  ├─ components/
│  │  ├─ ui/  (button, badge, container, section, site-header, site-footer)
│  │  └─ brain/ (brain-geometry.ts [pure], brain-scene.tsx, brain-visual.tsx)
│  └─ app/                   # App Router
│     ├─ layout.tsx  page.tsx  not-found.tsx  robots.ts  sitemap.ts  globals.css
│     ├─ login/  (page.tsx "use client", actions.ts)
│     ├─ dashboard/  (page.tsx, dashboard-client.tsx, actions.ts)
│     ├─ vision/ beta/ contact/ privacy/ terms/   # static server components
│     └─ api/ health/ profile/ goals/ goals/[id]/ goals/[id]/status/
└─ tests/  helpers/ + 8 unit *.test.ts + db-integration.test.ts
```

**Notably absent:** `src/core/` (documented pure mastery/planner/revision layer),
`content/` (learning content), any `.github/` CI, any `vercel.json`, any
Prettier/Biome config, and any AI SDK. `.next/` and `tsconfig.tsbuildinfo` exist on
disk but are gitignored. `.env.local` does **not** exist here (verified by
existence check only; contents never read).

**Working tree:** 11 modified files plus new untracked files/dirs (e.g.
`src/app/beta/`, `src/components/`, `src/config/`, `docs/design.md`) versus `HEAD`.
These are the in-progress "Milestone 2A" public-site work and are what I audited.
`git status`/`git diff` were read only; nothing was committed.

---

## 3. Technology stack and verified versions

Versions are read from `package.json` and confirmed via `pnpm ls --depth 0`.

| Concern | Choice | Verified version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack, Cache Components) | **16.4.0** |
| UI runtime | React / React DOM | **19.3.0** |
| Language | TypeScript | **5.9.3** |
| Node runtime | Node (engines `24.x`, `.nvmrc`) | **24.20.0** |
| Package manager | pnpm (`packageManager`) | **12.10.1** |
| Styling | Tailwind CSS + `@tailwindcss/turbopack` | **4.3.3** |
| Auth | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | **2.117.3 / 0.12.7** |
| Database | PostgreSQL (Supabase, hosted) | — |
| ORM + migrations | Drizzle ORM + Drizzle Kit (`postgres` driver) | **0.45.4 / 0.31.11 / 3.4.9** |
| Validation | Zod | **4.6.5** |
| 3D visual | three + @react-three/fiber (+@types/three) | **0.186.1 / 9.8.1 / 0.186.0** |
| Tests | Vitest (two configs) | **5.0.3** |
| Tooling | tsx, dotenv, server-only | 4.23.15 / 18.0.7 / 0.0.1 |
| Lint | ESLint + eslint-config-next | **9.39.5 / 16.4.0** |
| Hosting | Vercel (`https://rismon.ai`) | — (per README/docs) |

**Config evidence:** `next.config.ts` sets `cacheComponents: true` and
`partialPrefetching: true`, wires the Tailwind Turbopack loader, and adds four
security headers (no CSP — see §8). `tsconfig.json` is `strict`, maps `@/*` ->
`./src/*`, `target ES2017`. `vitest.config.mts` aliases `@` -> `src` and stubs
`server-only` so pure-Node tests can import server modules.

**Minor observations (no action taken):** `@types/node` is `^20` while runtime is
Node 24 (harmless today). No AI SDK installed; `AI_PROVIDER_API_KEY` is a
planned/unused placeholder. No duplicated state/data-fetching library — plain
`fetch` in the one client component + server components; no React
Query/Redux/Zustand. No Docker/Python/extra UI library, consistent with the
documented "no extra frameworks" rule.

---

## 4. Existing AI-agent instruction files

**There is exactly one AI-agent instruction file: `AGENTS.md` at the repo root.**
A filesystem search for `AGENTS.md`, `CLAUDE.md`, `CLINE.md`/`cline.md`,
`.cursorrules`, `.windsurfrules`, `.github/`, `copilot-instructions.md`, and
`GEMINI.md` found only `AGENTS.md`. There are **no nested** instruction files, so
all rules apply repo-wide.

`AGENTS.md` (paraphrased): humans run git/release commands; never commit/print/log
secrets, `.env` files, or DB dumps; never read real `.env*` (use `pnpm check:env`);
ask before installing global software; keep changes small; no new frameworks/deps
without justification; read `docs/architecture.md` first; **layering** (routes =
no business logic, services scoped by `learnerId`, identity from verified session);
**mastery** (frontend never computes it, AI output validated and can never set it,
mastery/planner/revision only in **pure tested core modules**); **DB** (schema only
via human-reviewed Drizzle migrations; every table-creating migration must enable
RLS and revoke from `anon, authenticated`); add/update tests; run checks and report
real output; PowerShell-compatible commands; ask instead of guessing; stay in the
current milestone.

It also contains an auto-generated `<!-- BEGIN:nextjs-agent-rules -->` block (added
by `next dev`) warning that this Next.js version has breaking changes and to read
`node_modules/next/dist/docs/` before coding. Self-maintaining — leave as-is.

**Consistency:** the instruction files are **consistent, not conflicting or
outdated**. `README.md` and `docs/architecture.md` reinforce the same rules. The one
flag is a conflict between instructions and **aspirational product copy**:
`README.md`, `/vision`, `/`, and `/beta` describe an AI tutor with lessons, practice,
and spaced revision and name **"networking fundamentals"** as the first subject —
none implemented, and "networking fundamentals" differs from the stated first journey
(**Cloud Security Engineer**). The `/beta` and FAQ copy is honest that these pieces
are "still being built," but wording must be updated when the real product ships.
(No files were changed.)

---

## 5. Feature inventory and implementation status

Legend: **IV** implemented & verified · **PI** partially implemented · **UI** UI-only
· **Mock** placeholder/mock · **Cfg** configured but unverified · **NF** not found.

| # | Feature | Where | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Email+password **sign-in** | `login/page.tsx` + `login/actions.ts` (`signInWithPassword`) | **IV** | Server action + `requireLearner`/`routes-unauthenticated` tests pass |
| 2 | **Sign out** | `dashboard/actions.ts` (`signOutAction`) | **IV** | Server action + redirect |
| 3 | **Session refresh (middleware)** | `src/proxy.ts` (`auth.getClaims()`) | **Cfg** | Code present; no runtime test (needs live Supabase) |
| 4 | **Signup / registration** | — | **NF** | No `signUp`/OAuth/magic-link anywhere; accounts created via Supabase/admin |
| 5 | **Onboarding flow** | — | **NF** | No onboarding route/component |
| 6 | **Learner profile** (display name, timezone) | `services/profile.ts`, `/api/profile`, dashboard form | **IV** | Service + Zod + DB-integration tests |
| 7 | **Goals CRUD** | `services/goals.ts`, `/api/goals*`, dashboard | **IV** | Service + transition table + DB-integration tests |
| 8 | **Goal status transitions** | `lib/goals/transitions.ts` | **IV** | Pure module + `goal-transitions.test.ts` |
| 9 | **One-active-goal invariant** | `schema.ts` partial unique index + migration | **IV** | `goals_one_active_per_learner`; DB test asserts SQLSTATE 23505 |
| 10 | **Dashboard** (profile + goals) | `dashboard/page.tsx`, `dashboard-client.tsx` | **IV** | Server page loads real data; client mutates via `/api` |
| 11 | **Public marketing site** | `/`, `/vision`, `/beta`, `/contact`, `/privacy`, `/terms`, 404 | **IV** | Static server components; `sitemap-robots.test.ts` |
| 12 | **Design system** | `components/ui/*`, `globals.css` tokens | **IV** | Tailwind v4 tokens, light/dark |
| 13 | **3D brain hero** | `components/brain/*` | **IV** | Pure `brain-geometry.ts`; `brain-geometry.test.ts` |
| 14 | **Health endpoint** | `/api/health` | **IV** | `health.test.ts` |
| 15 | **Diagnostic / assessment** | — | **NF** | No code (only aspirational copy) |
| 16 | **Roadmap / learning path** | — | **NF** | Zero `roadmap` references |
| 17 | **Lessons / exercises / challenges / projects** | — | **NF** | Only static copy strings |
| 18 | **Mastery model** | `src/core/` (missing) | **NF** | No code; documented future layer |
| 19 | **Attempts / misconceptions history** | — | **NF** | No tables/code |
| 20 | **Adaptive planner / "what next"** | — | **NF** | No code |
| 21 | **SMART planning** | — | **NF** | No code |
| 22 | **AI provider integration** | — | **NF** | No SDK; `AI_PROVIDER_API_KEY` unused placeholder |
| 23 | **Spaced revision scheduling** | `src/core/` (missing) | **NF** | Documented future layer |
| 24 | **Gamification / mastery-based progress** | — | **NF** | Dashboard shows goal status only, no mastery |
| 25 | **Data export / delete / reset** | — | **NF** | Only DB cascade on auth-user delete (not user-facing) |
| 26 | **Row-level security** | `drizzle/0000_*.sql` | **IV** (migration) | RLS + `REVOKE ALL … FROM anon, authenticated` present |

Note on #6/#7: verified by reading code + passing unit tests; the **DB round-trip**
and cross-user isolation are asserted by `tests/db-integration.test.ts`, which I did
**not** run (requires live Supabase — see §10).

---

## 6. Application architecture and important data flows

The code follows a clean 4-layer model documented in `docs/architecture.md`:

```
UI / route handlers  ->  services  ->  data access  ->  pure core modules
```

- **Routes (`src/app`)** hold no business logic. They authenticate, parse/validate
  with Zod, call a service, and shape the response. Example:
  `src/app/api/goals/route.ts` → `requireLearner()` → `goalCreateSchema.safeParse`
  → `createGoal(learnerId, data)` → `goalDto`.
- **Services (`src/server/services`)** hold business logic + authorization. Every
  function takes `learnerId` as the first parameter and scopes queries by it. The
  server (not the client) decides goal status on create (`active` if none active,
  else `paused`).
- **Data access (`src/server/data`)** contains all Drizzle queries; every read/write
  is filtered by `learnerId` (e.g. `selectGoalForLearner` uses `and(eq(id), eq(learnerId))`).
- **Pure core (`src/core`)** — the intended home for mastery/planner/revision —
  **does not exist yet**.

**Error handling:** typed errors (`src/server/errors.ts`) map to HTTP in
`http/route-errors.ts` with safe messages only (401/404/409/422/500). Notably,
`NotFoundError` is returned for both "missing" and "belongs to another learner," so
ownership is never leaked.

**Key data flows:**
1. *Sign-in:* browser `login/page.tsx` → server action `signInAction`
   (`signInWithPassword`) → Supabase sets HTTP-only session cookie → client
   `router.push('/dashboard')`.
2. *Request auth:* `src/proxy.ts` refreshes the near-expiry session before every
   request; protected server code calls `requireLearner()` (`auth.getUser()`).
3. *Dashboard load:* `dashboard/page.tsx` (server) → `requireLearner()` →
   `ensureProfile` + `listGoals` → passes DTOs to `DashboardClient`.
4. *Mutations:* `DashboardClient` `fetch()`s `/api/profile` and `/api/goals*`, then
   re-fetches the goals list. `changeStatus` calls the transition table client-side
   only to decide which buttons to show; the server re-validates.
5. *Sign-out:* server action `signOutAction` → `supabase.auth.signOut()` → redirect.

---

## 7. Database schema and data ownership

PostgreSQL via Supabase; all app access is server-side Drizzle over `DATABASE_URL`
(never the auto-generated Data API). One migration: `drizzle/0000_flawless_lilandra.sql`.

**`learner_profiles`** — `id` uuid PK (equals `auth.users.id`, no default; FK to
`auth.users` ON DELETE CASCADE, hand-written), `display_name` (≤80), `timezone`
(default `'UTC'`), `created_at`/`updated_at`.

**`goals`** — `id` uuid PK (`gen_random_uuid()`), `learner_id` FK →
`learner_profiles(id)` ON DELETE CASCADE (indexed), `title` (1–200),
`description` (≤2000), `target_outcome` (≤500), `status`
(`active|paused|archived|completed`), `deadline` (date), `hours_per_week` (1–80),
timestamps. **Partial unique index** `goals_one_active_per_learner` enforces at most
one active goal per learner at the database level.

**Ownership boundaries:** every learner owns their profile (1:1 with auth user) and
their goals (1:many). Ownership is enforced in two independent ways — service-layer
`learnerId` scoping (primary) and RLS + revokes (closes the Data API path entirely).

**Progress persistence:** profile + goals persist in Postgres and survive refresh/new
sessions; the DB-integration suite asserts a goal created by one connection is visible
over a fresh connection (not run here). **There is no learning-progress data model
yet** (no mastery/attempts/revision tables) — the only "progress" is goal status.

**Deletion:** deleting an auth user cascades to profile and goals (FK). There is no
user-facing delete/export/reset.

---

## 8. Authentication and security findings

**Authentication (Supabase SSR, cookies):**
- Session lives in HTTP-only cookies shared via `@supabase/ssr`.
- `src/proxy.ts` (Next 16's replacement for `middleware.ts`) refreshes the near-expiry
  session with `auth.getClaims()` on every request; passes through if env not set.
- Browser client (`lib/supabase/client.ts`) for sign-in; server client
  (`lib/supabase/server.ts`) for server components/actions/routes.

**Authorization:** `requireLearner()` calls `auth.getUser()` (server-verified) and
returns `{ learnerId, email }` or throws `UnauthenticatedError` (→ 401). `getSession()`
is never used for authorization. `learnerId` is only ever taken from the verified
session and passed explicitly to services — never from body/query/headers. Strict
Zod schemas reject any client-supplied `learner_id` (asserted in unit tests).

**Secret handling — strong:** `SUPABASE_SERVICE_ROLE_KEY` is used **only** in
`tests/helpers/`; `src/` never imports it. `.env*` is gitignored and excluded from
Cline/Roo. `scripts/check-env.ts` prints names + set/missing only. Sign-in failures
log a single line with a fixed label + Supabase code/status, never emails/tokens
(`server/auth/sign-in-log.ts`, covered by `sign-in-log.test.ts`). I did **not** open
any `.env*` file.

**Cross-user risk — low:** queries are `learnerId`-scoped; foreign/missing records
return identical `NotFoundError` (404). RLS enabled with no policies + `REVOKE ALL`
from `anon, authenticated` means Supabase's Data API cannot touch learner tables.

**Headers:** `next.config.ts` sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a
`Permissions-Policy`. **No Content-Security-Policy yet** — explicitly noted as a later
task (needs `unsafe-inline/eval` audit + Supabase origins). The 3D brain/WebGL will
make a CSP non-trivial, so plan it before adding more client script.

**Observations:** no rate limiting beyond Supabase defaults; no account-lockout logic;
`/dashboard` uses `export const instant = false` (correctly opting out of instant-nav
prerender for a session-reading route). No secret values are reproduced anywhere in
this report.

---

## 9. Current user experience and route map

**Route map (from `src/app`):**

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | Public (static) | Marketing home; 3D brain hero; how-it-works; FAQ |
| `/vision` | Public (static) | Product principles + "where we are" |
| `/beta` | Public (static) | Private-beta info + "email us" CTA (no live form) |
| `/contact` | Public (static) | Contact email |
| `/privacy` | Public (static) | Draft privacy notice (what's stored today) |
| `/terms` | Public (static) | Draft terms |
| `/login` | Public (client) | Email + password sign-in |
| `/dashboard` | **Protected** (server) | Profile + goals management |
| `/api/health` | API | `{status:"ok"}` |
| `/api/profile` (GET/PATCH) | API (auth) | Profile read/update |
| `/api/goals` (GET/POST) | API (auth) | List/create goals |
| `/api/goals/[id]` (GET/PATCH) | API (auth) | Read/update one goal |
| `/api/goals/[id]/status` (POST) | API (auth) | Change goal status |
| `/robots.txt`, `/sitemap.xml`, `/404` | Public | SEO / not-found |

**First-time visitor:** lands on `/` (marketing), sees the brain hero and the
"request beta access" CTA. There is **no self-serve signup** — `/beta` just says
"email us." Accounts are created out-of-band (Supabase/admin/test helper).

**Signup / login:** only **login** exists. On success the client navigates to
`/dashboard`. Failures show a generic message and log a secret-safe line server-side.

**After authentication → `/dashboard`:** a real, working screen with a **Profile** form
(display name, IANA timezone), a **Goals** section (list with status badge + allowed
transition buttons: Pause/Resume/Archive/Complete), and a **New goal** form (title,
description, target outcome, deadline, hours/week). All mutations hit the real `/api`
endpoints and persist. Sign out is available.

**Real vs placeholder:** everything on `/dashboard` is real. All the learning-related
imagery on the marketing pages ("short lessons," "checks that ask you to demonstrate
the skill," "remembers your misconceptions," "AI") is **aspirational copy** with no
underlying implementation. There is **no roadmap, diagnostic, assessment, lesson,
mastery, or progress** experience anywhere.

**Conflict with the intended mentoring system:** the post-login experience ends at
"manage a list of goals." There is no path from a goal to a learning journey — no
onboarding to capture existing knowledge, no capability map, no plan, no practice,
no evidence of mastery. The intended product needs an entirely new authenticated
experience layered on top of the existing auth + goal/profile foundation.

---

## 10. Tests and verification results

Commands run from the repo root in PowerShell; real exit codes captured.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | **PASS** — exit 0, no findings |
| Type check | `pnpm typecheck` | **PASS** — exit 0, no errors |
| Unit tests | `pnpm test` | **PASS** — 8 files, **50 tests passed** (~8s) |
| Build (no env) | `pnpm build` | **FAIL** — exit 1 (see below) |
| Build (dummy env) | `pnpm build` w/ placeholder Supabase URL/anon key | **PASS** — exit 0, 16 routes |
| Env check | `pnpm check:env` | Ran; **all 7 vars `missing`** (no `.env.local` here) |
| DB tests | `pnpm test:db` | **Not run** — needs live Supabase + `ALLOW_DB_TESTS` |

**Unit test files (all passing):** `goal-transitions`, `sign-in-log`, `health`,
`sitemap-robots`, `require-learner`, `brain-geometry`, `validation`,
`routes-unauthenticated`. The DB round-trip / cross-user-isolation suite lives in
`tests/db-integration.test.ts`, intentionally excluded from `pnpm test`.

**Build nuance (important):** `pnpm build` **fails locally with no `.env.local`**
because prerendering `/dashboard` calls `requireLearner()`, which throws "Supabase
environment variables are not set." This is a **local-environment artifact, not a code
defect** — with placeholder env values the build succeeds and emits all 16 routes,
correctly marking `/dashboard` and `/api/*` as dynamic. On Vercel the env vars are
set, so this does not affect deploys. (I set two placeholder env vars only in-memory
for the probe build and cleared them afterward; no file changed.)

**Not run / not verified:** `pnpm test:db` (needs live Supabase + service key;
creating/deleting throwaway users touches external state — out of scope for a
read-only audit) and any live browser flow (no `pnpm dev` + manual sign-in, since no
credentials and it would create auth users). RLS behaviour is verified by reading the
migration, not by execution.

---

## 11. Reusable code and infrastructure

**Reuse essentially unchanged (high value):**
- **Auth stack:** `src/proxy.ts`, `lib/supabase/{client,server}.ts`,
  `server/auth/require-learner.ts` — a correct, secure session model.
- **Layering + HTTP plumbing:** `server/errors.ts`, `server/http/{dto,route-errors}.ts`,
  `server/validation/*` — the route→service→data pattern and safe error mapping are
  exactly what the new learning features should extend.
- **DB client + schema conventions:** `server/db/client.ts` (lazy, `prepare:false`,
  `max:1`) and `server/db/schema.ts`; the RLS+revoke migration pattern is a template
  for every new table.
- **Design system:** `components/ui/*` + `globals.css` tokens (Button, Badge,
  Container, Section, SiteHeader, SiteFooter) — build new product UI on these.
- **3D brain visual:** `components/brain/*` — pure, tested, performant; keep for the
  marketing hero.
- **Test harness:** `vitest.config.mts` + `vitest.db.config.mts`, `tests/helpers/*`,
  `scripts/check-env.ts` — reuse for all new logic; the DB-integration pattern
  (throwaway users, cross-user isolation) is directly reusable for new tables.
- **Profiles + goals services/data:** proven, tested building blocks; goals likely
  become the "ambition" the learning journey hangs off.

**Reuse after modification:**
- **Goals model** — keep, but likely rename/extend toward "ambition"; revisit the
  one-active-goal invariant (§16) if multiple ambitions are needed.
- **Dashboard** — keep the shell and profile section; add onboarding + learning views.
- **Marketing copy** — update "networking fundamentals" → Cloud Security Engineer and
  de-aspirationalize once features are real.

**Keep temporarily / refactor later:**
- **`dashboard-client.tsx`** is one large client component using plain `fetch` +
  `useState`. Fine for two resources; will need structure (or a data-fetching layer) as
  the learning UI grows.
- **`/dashboard` `instant = false`** — acceptable now; revisit when adding cached
  session-derived data.

**No component needs replacement for architectural conflict** — the foundation aligns
with the intended product. The work is additive.

---

## 12. Incomplete, duplicated, outdated, or conflicting implementation

**Incomplete (by design/milestone):**
- The **learning engine is entirely missing** — expected per the milestone plan
  (`src/core`, `content/` documented as future), but it is the core of the intended
  product.
- **No signup flow** — private-beta "email us" only; blocks self-serve validation.
- **`/beta` request form** is not live (stated on the page).
- **`/privacy` and `/terms`** are "DRAFT, pending review"; `siteConfig.jurisdiction`
  is a `[JURISDICTION]` placeholder.

**Duplicated:** no meaningful code duplication. The isomorphic `GOAL_TRANSITIONS`
table is intentionally shared by UI (which buttons to show) and service (authority) —
a documented pattern, not duplication to remove.

**Outdated / version notes:** `@types/node` (`^20`) trails the Node 24 runtime
(cosmetic); `next-env.d.ts` and `tsconfig.tsbuildinfo` are generated/gitignored
(normal).

**Conflicting:**
- **Product-subject conflict:** marketing/docs say the first subject is
  **"networking fundamentals"**, but the stated direction is **Cloud Security
  Engineer** — will mislead users and agents until resolved.
- **Aspirational vs. actual copy:** README/`/vision`/`/`/FAQ describe AI tutoring,
  lessons, practice, spaced revision, and misconception memory as if features; the
  FAQ/beta pages hedge ("still being built"), but the README's opening line reads as
  a finished capability — risk of over-promising.
- **One-active-goal invariant vs. multi-ambition vision:** the DB partial unique index
  enforces a single active goal per learner. If the product later lets a learner pursue
  multiple ambitions concurrently, this becomes a schema/migration change (§16). Not a
  bug today — a design decision to revisit.

---

## 13. Missing capabilities required by the intended product

Each item below is **not found** and must be built:

1. **Onboarding + ambition selection** (e.g. Cloud Security Engineer) capturing existing
   knowledge/experience.
2. **Capability model** — capabilities a goal requires + the learner's current level.
3. **Diagnostic / assessment** to establish starting levels.
4. **SMART goal planning** turning an ambition into a specific, measurable plan.
5. **Learning path / roadmap** generator adapted to gaps.
6. **Lesson / explanation delivery** (short, focused).
7. **Exercises, challenges, practical projects** with deterministic answer keys.
8. **Mastery model** — pure, tested, in `src/core`; never set by AI; not computed in the
   frontend.
9. **Attempts + misconceptions history** — persistent records of tries, errors, and why.
10. **Adaptive planner / "what next"** — pure logic choosing the next activity.
11. **Spaced revision scheduling** — pure logic (time injected, never read directly).
12. **AI provider integration** (explanations/practice proposals only) + **validation**
    so AI can never set mastery or override keys. (`AI_PROVIDER_API_KEY` is the reserved
    placeholder; no SDK installed — pick one deliberately.)
13. **Mastery-based gamification / visual progress** reflecting real evidence.
14. **Multi-ambition support** (revisit the one-active-goal invariant).
15. **User-facing data export / delete / reset** (GDPR-friendly).
16. **A Content-Security-Policy** (deferred; needed once AI + more client script ship).

---

## 14. Recommended keep / modify / replace / build-new decisions

| Decision | Component | Rationale |
| --- | --- | --- |
| **Keep (no change)** | Auth (`proxy.ts`, supabase clients, `require-learner`), error/http/validation plumbing, DB client, design system, 3D brain, test harness, `check-env` | Correct, tested, secure; aligns with target architecture |
| **Modify** | Goals model → "ambition" (rename/extend; revisit one-active invariant) | Goals are the natural anchor for a journey |
| **Modify** | Dashboard shell + profile section (add onboarding + learning views) | Reuse layout/nav; add the new experience |
| **Modify** | Marketing/README/FAQ copy (Cloud Security Engineer; de-aspirationalize) | Remove over-promise; align subject |
| **Refactor later** | `dashboard-client.tsx` (split as learning UI grows) | Fine now; won't scale to the full product |
| **Build new** | `src/core` (mastery, planner, revision — pure + tested), content, onboarding, assessment, roadmap, lessons, exercises, attempts/misconceptions, AI integration + validation, gamification, data export/delete | The entire learning/mentoring domain |
| **Replace** | *Nothing* — no existing component conflicts with the target architecture | Foundation is sound; work is additive |

The lowest-risk path is to **build the new domain additively on top of the existing
auth + layering + design system**, adding each new table with the established
RLS+revoke migration pattern and each new rule as a pure, tested core module.

---

## 15. Proposed implementation priorities

Sequenced so each step is independently verifiable and low-risk (owner to confirm scope):

1. **Align direction (no code):** confirm first journey = Cloud Security Engineer;
   decide multi-ambition vs one-active-goal; update README/FAQ copy. *(Decisions first.)*
2. **Onboarding + ambition:** reuse the goal/ambition model; capture prior knowledge;
   add `src/core` skeleton with the first pure, tested module (e.g. capability-gap
   calculation). Add DB tables via RLS+revoke migration.
3. **Diagnostic + capability model + SMART plan:** pure core logic + tests; services +
   routes following the existing pattern; minimal UI on the design system.
4. **Mastery + attempts + misconceptions:** pure mastery module (time injected) with
   tests; persistence tables; answer validation owned by deterministic code.
5. **Adaptive planner + spaced revision:** pure, tested; wire to the "what next" view.
6. **Lessons / exercises / projects delivery** + mastery-based progress UI.
7. **AI integration (proposals only)** with strict validation; add a CSP; keep AI out
   of mastery/answer keys.
8. **Gamification + data export/delete/reset**; then broaden to more ambitions.

Each step: pure core + unit tests first, then service + route + DB-integration test,
then UI — mirroring how profiles/goals were built and verified.

---

## 16. Risks, unknowns, and questions requiring the owner's decision

**Risks:**
- **Scope:** the learning engine is large; without staged milestones it can sprawl.
  The existing "one milestone at a time" rule is the mitigation.
- **One-active-goal invariant** conflicts with multi-ambition if a learner should run
  several journeys at once — changing it later needs a migration.
- **No CSP yet** — add before shipping AI/more client script (WebGL makes it non-trivial).
- **No self-serve signup** — validation with real users depends on manual account creation.
- **Local build requires env vars** — fine on Vercel, but new contributors may hit the
  `/dashboard` prerender error until they set `.env.local`.
- **Aspirational copy** may over-promise to early beta users.

**Unknowns / not verified (need live env or owner input):**
- Whether `pnpm test:db` passes against the live DB (not run here).
- Runtime behaviour of `src/proxy.ts` session refresh and the full sign-in flow in a
  browser (no credentials; would create auth users).
- Actual deployed Vercel env/configuration (no `vercel.json` in repo; hosting details
  are per README/docs, not verified against the Vercel project).
- Which AI provider is intended (none installed; only a reserved env placeholder).

**Questions for the owner:**
1. Is the first journey **Cloud Security Engineer** (your brief) or **networking
   fundamentals** (current copy/docs)? This drives content + copy updates.
2. Should a learner pursue **multiple ambitions at once**? (Determines whether to keep
   or change the one-active-goal DB invariant.)
3. Do we need **self-serve signup**, or stay invite/manual during beta?
4. **Which AI provider** should we standardise on for explanations/practice?
5. Desired **data export/delete/reset** scope and timing (privacy/GDPR)?
6. Confirm the **milestone boundaries** so implementation stays inside scope.

---

*End of audit. No files other than this report were created or modified; no code was
implemented; nothing was committed, pushed, or deployed. Awaiting the owner's review.*







