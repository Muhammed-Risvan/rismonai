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

## AI principle

**The AI proposes; deterministic code validates and owns mastery state.** No AI output may directly set mastery or override answer keys. All AI output is validated before it is used.

## Folders

| Folder | Purpose | Status |
| --- | --- | --- |
| `src/app` | App Router pages and route handlers | exists |
| `src/lib` | isomorphic helpers (Supabase clients, timezone, transition table) | exists |
| `src/server` | auth, validation, services, data access, http helpers | exists |
| `src/core` | pure domain logic (mastery, planner, revision) | future milestone |
| `content/` | learning content | future milestone |
| `docs/` | documentation | exists |
| `tests/` | Vitest tests | exists |

Folders are created only when they contain a file — no empty scaffolding.
