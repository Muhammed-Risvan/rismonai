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

Only the Next.js/TypeScript/Tailwind/Vitest part is installed so far (Milestone 0). Supabase, Drizzle, Zod and any AI SDK are **not installed yet** and must not be added without justification. No Docker, no Python service, no extra UI libraries, no other frameworks.

## Layers

```
UI / route handlers  ->  services  ->  data access  ->  pure core modules
```

### 1. UI and route handlers — `src/app` (thin)

Pages and route handlers contain **no business logic**. They parse and validate input (Zod), obtain the learner identity from the verified authenticated session, call service functions, and shape the HTTP response.

### 2. Services — `src/server` (business logic + authorization)

All business logic and **all authorization** live here. Every service function takes `learnerId` **explicitly** as a parameter. Scoping every query path by `learnerId` in the service layer is the primary enforcement of per-learner data isolation.

### 3. Data access — under `src/server` (all database queries)

Every database query goes through this layer, using Drizzle over a **direct database connection** (`DATABASE_URL`), server-side only.

- The learner ID always comes from the **verified authenticated session**, never from browser-supplied input.
- Row-level security is enabled on **every** table with **no** access granted to the public `anon` or `authenticated` roles, so Supabase's auto-generated API cannot read or write learner data.

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
| `src/server` | services and data access | future milestone |
| `src/core` | pure domain logic (mastery, planner, revision) | future milestone |
| `content/` | learning content | future milestone |
| `docs/` | documentation | exists |
| `tests/` | Vitest tests | exists |

Folders are created only when they contain a file — no empty scaffolding.
