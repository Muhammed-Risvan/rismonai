# Architecture

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Auth & database | Supabase Auth + PostgreSQL |
| Data access & migrations | Drizzle ORM + Drizzle Kit |
| Validation | Zod |
| Tests | Vitest |
| Hosting | Vercel (rismon.ai) |

Next.js, TypeScript, Tailwind, Vitest, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Drizzle ORM + Drizzle Kit, Zod, postgres.js, `server-only`, `tsx` and `dotenv` are installed. Any AI SDK is **not installed** and must not be added without justification. No Docker, no Python service, no extra UI libraries, no other frameworks.

## Authentication flow (Supabase SSR)

1. **Session storage** — the Supabase Auth session lives in HTTP-only cookies, shared between browser and server via `@supabase/ssr`.
2. **`src/proxy.ts`** — Next.js 16's proxy (formerly middleware.ts) runs before every request, refreshes an near-expiry session with `auth.getClaims()` and writes updated cookies to the response. It only uses the public anon/publishable key.
3. **Clients** — `src/lib/supabase/client.ts` (browser, `createBrowserClient`) for sign-in from Client Components; `src/lib/supabase/server.ts` (`createServerClient` + `next/headers` cookies) for Server Components, actions and route handlers.
4. **Authorization** — `requireLearner()` in `src/server/auth/require-learner.ts` calls `auth.getUser()`, the server-confirmed verification recommended by current Supabase docs. **`getSession()` data is never used for authorization.** It returns `{ learnerId, email }` or throws `UnauthenticatedError` (→ 401).
5. **Learner identity** — `learnerId` comes *only* from `requireLearner()`, never from request bodies, query strings or headers. Routes pass it as the **first argument** to every service function.

### Caching model (Cache Components)

This project runs with Next.js 16 **Cache Components** enabled (`cacheComponents: true`, Turbopack). Data fetching is dynamic by default and nothing is cached unless a route opts in with `use cache` — so the old `dynamic` / `revalidate` route segment configs were **removed** in Next 16 and must not be used (the build rejects them).

- **Route handlers** (`/api/*`) always run at request time; no segment config is needed.
- **The `/dashboard` page** reads the auth session (cookies), which is runtime data that cannot be prerendered into the static shell. It therefore sets `export const instant = false` to declare that navigating to it is allowed to block on the session rather than stream a shell. This is the documented approach for session-reading routes under Cache Components.

### Why the secret key is never used by app code

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security entirely — anyone holding it owns the whole database. It is therefore restricted to test helpers under `tests/helpers/` (Part B of Milestone 1), never imported by `src/`. App code only ever holds the public anon/publishable key, which RLS locks out of learner data (see below), so even a leaked app key cannot read these tables through Supabase's auto-generated Data API.

## Layers

```
UI / route handlers  ->  services  ->  data access  ->  pure core modules
```

### 1. UI and route handlers — `src/app` (thin)

Pages and route handlers contain **no business logic**. They parse and validate input (Zod), obtain the learner identity from the verified authenticated session, call service functions, and shape the HTTP response.

### 2. Services — `src/server` (business logic + authorization)

All business logic and **all authorization** live here. Every service function takes `learnerId` **explicitly** as a parameter. Scoping every query path by `learnerId` in the service layer is the primary enforcement of per-learner data isolation.

### 3. Data access — under `src/server` (all database queries)

Every database query goes through this layer, using Drizzle over a **direct database connection** (`DATABASE_URL`), server-side only. The client (`src/server/db/client.ts`) starts with `import "server-only"`, uses `prepare: false` (required by the Supabase transaction pooler), a small pool (`max: 1`) and is initialised **lazily** so builds and unit tests never need env vars or a connection.

- The learner ID always comes from the **verified authenticated session**, never from browser-supplied input.
- Row-level security is enabled on **every** table with **no** access granted to the public `anon` or `authenticated` roles, so Supabase's auto-generated API cannot read or write learner data.
- Defense in depth: service-layer `learnerId` scoping is the primary enforcement; RLS + revokes mean the Data API path does not exist at all; the partial unique index makes "one active goal per learner" a database invariant, not a code convention. See `docs/database.md`.

### 4. Pure core modules — `src/core` (mastery, planner, revision)

Mastery rules, the planner and revision scheduling live here and are pure:

- No database, no network, no file I/O.
- No direct clock calls — the current time is passed in as an input.
- Covered by unit tests in `tests/`.

Currently implemented: the content model and prerequisite DAG, referential
integrity, the deterministic diagnostic bank/selection/grading/coverage rules,
the immutable run snapshot, misconception detection, the `isIndependentPass`
evidence gate, the **mastery engine** (`evaluateMastery`) and the **revision
scheduler** (`scheduleReview`). **Not yet implemented:** the roadmap/planner,
and difficulty adaptation.

### The mastery ladder

`src/core/mastery.ts` is the single place a capability's level is decided. It
is pure: a function of recorded evidence and an injected `now`.

| State | Meaning |
| --- | --- |
| `unknown` | never assessed (the learner opted out) — honest, not a gap |
| `untested` | content exists, nothing assessed yet |
| `introduced` | taught, not yet practised |
| `practising` | some evidence, none of it independent (incl. assisted) |
| `demonstrated` | shown independently, once |
| `mastered` | shown independently, repeatedly, **across different items** |
| `revision-needed` | previously demonstrated, now due for reinforcement |

Three rules carry the product's honesty guarantee:

1. **Help is not proof.** A correct answer with hints (or in `guided` mode)
   never reaches `demonstrated`. It is progress, and it is shown as progress.
2. **A wrong answer resets the run.** Pass an item, fail a month later, pass a
   different one — that is *not* mastery. Only passes since the last wrong
   answer justify the current state.
3. **Repetition is not breadth.** Passing the same item twice is
   `demonstrated`, never `mastered`; mastery needs distinct items.

`evaluateMastery` accepts a `ceiling`. The diagnostic passes
`demonstrated`, so a handful of quiz questions can never award `mastered`.

Content owns pedagogy, the engine owns rules. A remediation-probe trigger
lives on the exercise as `reprobeOf`, not as a hardcoded slug map in the
engine, so adding a second ambition needs no engine change.

## AI principle

**The AI proposes; deterministic code validates and owns mastery state.** No AI output may directly set mastery or override answer keys. All AI output is validated before it is used.

No AI provider is integrated today (M10). `AI_PROVIDER_API_KEY` is a reserved
name only — `pnpm check:env` reports it as missing and nothing reads it.

## Evidence ledger and misconception memory

The rule the whole engine rests on: **a level is never an unsupported opinion.**

- `diagnostic_responses` stores every graded submission — including `mode`,
  `hints_used` and the `misconception_id` that the wrong answer evidences.
- Misconception detection is deterministic and content-driven
  (`src/core/diagnostic/misconception.ts`): an authored
  `misconceptionSignatures` entry on the exercise maps a *specific* wrong
  answer to a *specific* authored misconception. No signature match means
  `null` — "wrong, reason not identified" — which is shown honestly and never
  upgraded into a guess.
- Signatures are frozen into the run snapshot alongside the answer key, so a
  later content release cannot retroactively change which answers are
  attributable to a misconception.
- `learner_capabilities.evidence_count` / `assisted_pass` are written with the
  level, and the database enforces
  `level <> 'mastered' OR evidence_count > 0`.
- `learner_misconceptions` records exposure. Re-encountering increments a
  counter, never duplicates the row; passing the same item again **unassisted**
  resolves it. Resolution is earned, never self-declared.

`isIndependentPass()` in `src/core/attempt.ts` is the gate: only a correct,
unassisted attempt is eligible to count as mastery evidence.

## Public site (Milestone 2A)

Marketing pages (`/`, `/vision`, `/beta`, `/contact`, `/privacy`, `/terms`,
`not-found`, `robots`, `sitemap`) are thin Server Components under `src/app`
using the design system in `src/components/ui` (tokens in
`src/app/globals.css`, light/dark via `prefers-color-scheme`). The home hero's
skill-network artwork (`src/components/brand/skill-network-visual.tsx`) is a
**pure Server Component**: one inline SVG, no JavaScript, no WebGL, no
animation state. It is marketing artwork, explicitly NOT wired to learner data
— the dashboard's real skill network is still M12. (The previous React Three
Fiber hero was removed: it was decorative, took no data props, and shipped ~1MB
of `three` to the public site for an `aria-hidden` animation.)
Public pages hold no business logic and never compute mastery; sign-in and
sign-up failures are logged server-side as one short line (fixed label +
Supabase code/status, never emails/tokens). Company/contact values in
`src/config/site.ts` use the real values (Rismon.ai, from the house of
Labs3am.com, hello@rismon.ai); the registered jurisdiction is deliberately
**not** configured, because it is unconfirmed and inventing one would put a
false legal statement on a public page. Security headers (no CSP yet — a later
task) live in `next.config.ts`. See `docs/design.md`.

Marketing copy must describe only what is implemented. In particular the home
page may not claim misconception memory unless the engine records it.

## Learner surfaces (M2/M3)

- `/login` — sign-in **and** sign-up (Supabase email + password) on one page.
  Both run as server actions so failures are logged server-side. Sign-up
  honestly reports `needsEmailConfirmation` and does **not** navigate when no
  session was issued.
- `/onboarding` — static SMART-shaped intake (ambition, outcome, hours/week,
  optional deadline and background). Goal + ambition link are written in ONE
  transaction, so a journey can never be created half-linked.
- `/dashboard` — profile, goals, status transitions, subject linking, and a
  single "Start here" link to the diagnostic. The transition labels come from
  the shared isomorphic table (`src/lib/goals/transitions`), not a second
  client-side copy of the rules.
- `/diagnostic` — the baseline diagnostic runner. The client is a **pure view**:
  it posts the raw answer and renders exactly what the engine reports. It never
  computes a level, never infers correctness, and never shows a level the
  server did not send. `untested` is deliberately labelled "Not shown to have
  it yet" rather than "weak", because an untested skill is not a gap.

An unlinked goal (`ambition_id IS NULL`) cannot reach a diagnostic or a
roadmap, so `/diagnostic` and `/dashboard` both offer an explicit link action
(`PATCH /api/goals/[id]/ambition`).

## Folders

| Folder | Purpose | Status |
| --- | --- | --- |
| `src/app` | App Router pages and route handlers | exists |
| `src/lib` | isomorphic helpers (Supabase clients, timezone, transition table) | exists |
| `src/server` | auth, validation, services, data access, http helpers | exists |
| `src/core` | pure domain logic (content model, diagnostic, evidence contracts; mastery/planner/revision later) | exists |
| `src/components` | UI primitives, form elements, site header/footer, hero artwork | exists |
| `src/config` | site-wide public constants | exists |
| `content/` | learning content (seeded competency maps per ambition) | exists |
| `docs/` | documentation | exists |
| `tests/` | Vitest tests | exists |

Folders are created only when they contain a file — no empty scaffolding.
