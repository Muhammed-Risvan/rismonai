# M1 Implementation Report — Learner Data Model & Database Isolation

> Milestone **M1 only**. Prepared for owner review. No M2+ features implemented.
> Commands run from the repo root in PowerShell. No secrets, tokens, or `.env`
> contents appear in this report. Nothing was committed, pushed, tagged, or
> deployed. No destructive schema operations were performed.

Branch: `main` @ `112a013` (M0 applied) · Date: 2026-10-12

---

## 1. Implemented M1 requirements & acceptance criteria

**Scope decision (documented deviation, not silent expansion).** The plan's M1 bullet
lists many evidence tables (`learner_capabilities`, `attempts`, `misconceptions`,
`onboarding_answers`, `roadmap_items`, `revision_items`, `projects`, `project_evidence`).
Each is **consumed by a later milestone** (`learner_capabilities`→M5, `attempts`→M6,
`misconceptions`/`revision_items`→M9, `onboarding_answers`→M2/M3, `roadmap_items`→M8,
`projects`→M11). The task's explicit instructions — "create only the tables and
relationships explicitly required by M1," "do not prematurely implement later learning
features," "do not invent a broad schema beyond M1" — take precedence. M1's irreducible
core is the **learner data model + isolation**: the ambition catalog, the
goal↔ambition link, and preserving the existing primary-active-journey invariant.
This matches `spec.md` §5 ("reuse `goals`; add a nullable `ambition_id`; one primary
active journey already enforced").

| M1 requirement | Status | Where |
| --- | --- | --- |
| `ambitions` catalog table (reference data) | ✅ Done | `src/server/db/schema.ts` + `drizzle/0001_hard_brood.sql` |
| `goals.ambition_id` nullable FK → `ambitions` | ✅ Done | schema + migration (ON DELETE SET NULL) |
| Additive, backward-compatible migration | ✅ Done | `drizzle/0001_hard_brood.sql` (new table + nullable column + index + FK) |
| RLS + `REVOKE ALL … FROM anon, authenticated` on new table | ✅ Done | appended to migration `0001` |
| Idempotent seed from `content/` | ✅ Done | `src/server/services/seed-catalog.ts` |
| Services + data-access + Zod boundaries | ✅ Done | `src/server/{services,data,validation}/ambitions.ts` |
| Primary-active-journey invariant preserved (no change) | ✅ Verified | existing `goals_one_active_per_learner` index untouched |
| Server-side ownership enforcement on the link | ✅ Done | `setGoalAmbition` scopes by `learnerId` |
| Two-account isolation tests | ✅ Added | `tests/db-integration.test.ts` |
| Existing auth/services/tests still compatible | ✅ Verified | `pnpm test` 75/75 |

**Product decisions honored:** multiple saved ambitions are already possible (many
`goals` rows per learner); **one primary active journey** is enforced by the existing
partial unique index (kept, not migrated). A **saved ambition** = a `goals` row
(optionally linked to a catalog `ambitions` row via `ambition_id`); its **lifecycle** =
`goals.status`; the **primary active journey** = the single `status='active'` goal.

## 2. Schema and migration changes

**`src/server/db/schema.ts` (additive):**
- New `ambitions` table: `id` (text PK, slug), `name`, `description`, `target_outcome`,
  `level` (default `beginner`), timestamps; CHECK constraints for level, name length
  (1–120), and target_outcome length (≤500).
- New `goals.ambition_id` (text, nullable) → FK `ambitions.id` **ON DELETE SET NULL**
  (deleting a catalog ambition clears the link, never deletes a learner's goal), plus
  index `goals_ambition_id_idx`.
- Existing `goals` columns/constraints/indexes — including `goals_one_active_per_learner`
  — are **unchanged**.

**`drizzle/0001_hard_brood.sql` (generated, then hand-appended):**
- `CREATE TABLE ambitions`; `ALTER TABLE goals ADD COLUMN ambition_id`; add FK; add index.
- Hand-appended (Drizzle can't express RLS/GRANTs, matching `0000`'s pattern):
  `ALTER TABLE "ambitions" ENABLE ROW LEVEL SECURITY;` and
  `REVOKE ALL ON TABLE "ambitions" FROM anon, authenticated;`.
- Generated snapshot `drizzle/meta/0001_snapshot.json` + journal entry (idx 1) via
  `pnpm db:generate`. **Not applied** — the human reviews and applies with
  `pnpm db:migrate` (per `AGENTS.md`/`docs/development.md`).

**Rollback considerations:** additive and safe for existing data — a new table and a
nullable column. Existing `goals` rows get `ambition_id = NULL` automatically. Rollback
is a standard `DROP` of the new table/column/index/FK if ever needed (none of it touches
existing learner data). No destructive operations were run.

## 3. RLS policies and server-side ownership enforcement

- **`ambitions`** (reference/catalog data, not learner-owned): RLS enabled with **no
  policies** + `REVOKE ALL` from `anon, authenticated`, exactly like `0000`. The app
  reads/writes it only through the server-side Drizzle connection (owner role). The Data
  API cannot expose or mutate it.
- **`goals`** (learner-owned): RLS/revokes unchanged from `0000`; the new `ambition_id`
  column inherits the same table-level protection.
- **Server-side ownership:** `setGoalAmbition(learnerId, goalId, ambitionId)` updates
  `goals` with `WHERE id = goalId AND learner_id = learnerId`, so a learner can only link
  **their own** goal. A foreign/missing/malformed goal → `NotFoundError` (never
  distinguished). `learnerId` is always supplied by the caller from the verified session;
  the browser never provides it. Unknown ambition id → `NotFoundError` (and the DB FK is
  the final guard). Service-role key stays confined to `tests/helpers/`.

## 4. Isolation and regression test results

New DB-integration tests (in `tests/db-integration.test.ts`, gated by `ALLOW_DB_TESTS`,
run via `pnpm test:db`) cover the M1 requirements:

1. **Idempotent seed** — `seedAmbitionCatalog()` creates the catalog; re-running does not
   duplicate rows (raw `SELECT count` = 1 for `cloud-security-engineer`).
2. **Own-record access** — a learner links their own goal to `cloud-security-engineer`;
   the link persists and is visible via a scoped read.
3. **Invalid relationship** — linking to a non-existent ambition → `NotFoundError`; the
   goal stays unlinked. Raw INSERT with an unknown `ambition_id` → FK violation (23503).
4. **Two-account isolation** — learner A **cannot** link learner B's goal (NotFound), and
   B's goal stays unlinked; A's scoped list never contains B's goal.
5. **SET NULL behavior** — deleting a catalog ambition nulls the goal link, keeps the goal.
6. **Primary-active-journey invariant** — the existing one-active-goal index and service
   guard are untouched; the pre-existing tests asserting one active goal / conflict /
   SQLSTATE 23505 still apply unchanged.
7. **Data API lockdown** — the anon key cannot read or insert into `ambitions`.
8. **Regression** — all pre-existing DB tests (profile, goals, transitions, cascade,
   anon-key lockdown on `goals`/`learner_profiles`) remain.

**Exact commands + outcomes (this machine):**

| Command | Result |
| --- | --- |
| `pnpm db:generate` | **OK** — wrote `drizzle/0001_hard_brood.sql` + snapshot + journal |
| `pnpm test` | **PASS** — 12 files, **75 tests** (unchanged count; DB suite excluded here) |
| `pnpm test:db` | **BLOCKED (environment)** — suite compiles & runs; fails in `beforeAll` with `supabaseUrl is required` because no live Supabase env is present. **Not a code failure**; see §6. |
| `pnpm typecheck` | **PASS** — exit 0 |
| `pnpm lint` | **PASS** — exit 0, 0 warnings |
| `pnpm build` | **BLOCKED (environment)** — compiles successfully; fails only at the pre-existing `/dashboard` prerender (`Supabase environment variables are not set`). Unrelated to M1; see §6. |

Note on `pnpm test:db`: the suite **loads and type-resolves** (imports `@content`,
services, etc.) and reaches `beforeAll`, which is where it stops on the missing live env.
The 18 tests are reported **skipped** once env is absent. This proves the new code
compiles under the DB config but does **not** execute the isolation assertions against a
real database — that requires the owner to run `pnpm test:db` with env set (see §6).

## 5. Documentation changes for OpenRouter (planning only)

Updated the confirmed AI decision (**OpenRouter** as first planned provider) into the AI
milestone — **documentation only; no AI code, deps, requests, credentials, or dashboard:**

- `spec.md` §12 — OpenRouter named as the first planned provider (API aggregator, one key,
  OpenAI-compatible); multi-provider-by-design (task-oriented adapter; core logic never
  calls a provider); notes for secure API-key management, model discovery, connection
  testing, task-based routing, usage controls, and controlled fallback (all designed in
  M10); explicit statement that an AI response is **never the sole authority** for mastery
  or grading.
- `implementation-plan.md` §M10 — provider confirmed as OpenRouter; expanded to include the
  required capabilities (secure keys, model discovery, connection testing, task-based
  routing, usage/cost controls, controlled fallback); keeps milestone order and
  dependencies unchanged; adds a test for connection + model discovery against a stubbed
  client and a privacy/terms disclosure risk (OpenRouter is a third party).

Milestone order and dependencies are otherwise unchanged.

## 6. Build limitations and unresolved issues

- **Production build** requires Supabase env (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`); without it Next.js fails prerendering `/dashboard`
  (the limitation reported in M0, still unresolved here). It is **not** caused by M1 — the
  build compiles all M1 code successfully and fails only at that known point.
- **DB integration tests** require a live Supabase project + `ALLOW_DB_TESTS=true`; they
  could not run here (no env). The M1 isolation/regression assertions are therefore
  **written and compile-verified but not executed against a real database**. **Action for
  the owner:** review + apply `drizzle/0001_hard_brood.sql` (`pnpm db:migrate`), then run
  `pnpm test:db` with env set to confirm isolation against the live DB.

## 7. Files changed (and deletions)

**Added:**
- `src/server/data/ambitions.ts` — catalog reads + idempotent upsert + scoped goal-link update.
- `src/server/services/ambitions.ts` — `listAmbitions`, `requireAmbition`, `seedAmbition`, `setGoalAmbition` (ownership-enforced).
- `src/server/services/seed-catalog.ts` — seeds `ambitions` from `content/` idempotently.
- `src/server/validation/ambitions.ts` — `ambitionIdSchema` (slug), `goalAmbitionSchema`.
- `drizzle/0001_hard_brood.sql` — the migration (generated + hand-appended RLS/revoke).
- `drizzle/meta/0001_snapshot.json` — generated snapshot.
- `m1-implementation-report.md` — this report.

**Modified:**
- `src/server/db/schema.ts` — `ambitions` table + `goals.ambition_id` FK/index (additive).
- `src/server/http/dto.ts` — `goalDto` now includes `ambition_id`; added `ambitionDto`.
- `tests/db-integration.test.ts` — added M1 isolation/seed/FK/SET-NULL/Data-API tests.
- `drizzle/meta/_journal.json` — added migration entry (via `db:generate`).
- `vitest.db.config.mts` — added `@content` alias (mirrors `vitest.config.mts`/tsconfig).
- `spec.md`, `implementation-plan.md` — OpenRouter planning update (docs only).

**Deleted:** none. (I created then removed a premature `/api/ambitions` route during
development to keep M1 to the data model; it is not present in the final tree.)

## 8. Preservation of pre-existing work

The working tree already contained 11 modified tracked files + many untracked files
(M0 output + the in-progress public-site work). I ran **no** destructive git commands
(no `reset`/`clean`/`checkout`/`stash`) and did not revert or reformat unrelated changes.

- The same 11 pre-existing modified files remain modified and untouched by me:
  `README.md`, `docs/architecture.md`, `next.config.ts`, `package.json`,
  `pnpm-lock.yaml`, `src/app/dashboard/dashboard-client.tsx`,
  `src/app/dashboard/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`,
  `src/app/login/page.tsx`, `src/app/page.tsx`.
- All M0 output is preserved: `src/core/**`, `content/**`, `tests/core/**`,
  `m0-implementation-report.md`, and M0's `tsconfig.json` / `vitest.config.mts`
  alias additions (I extended the same `@content` alias into `vitest.db.config.mts`
  for consistency — additive).
- Final `git diff --stat` shows the pre-existing 11 files **plus** only my intended M1
  edits. New untracked paths this task: `src/server/data/ambitions.ts`,
  `src/server/services/ambitions.ts`, `src/server/services/seed-catalog.ts`,
  `src/server/validation/ambitions.ts`, `drizzle/0001_hard_brood.sql`,
  `drizzle/meta/0001_snapshot.json`, `m1-implementation-report.md`.

## 9. Scope confirmation (M2+ not implemented)

**M1 only.** No M2+ feature was implemented. Specifically, I did **not** add: onboarding,
diagnostic flows, lesson UI, exercise grading, mastery transitions/`learner_capabilities`,
`attempts`, `misconceptions`, `roadmap_items`, `revision_items`, `projects`/`project_evidence`,
personalized planning, Gemini/OpenRouter integration or any AI code/dependency, dashboards,
gamification, or export/deletion. Evidence tables are deferred to their owning milestones.
The existing dashboard and goals behavior are unchanged (the only user-visible DTO change
is that a goal now also reports its `ambition_id`, which is `null` for existing goals).

## 10. Prerequisites before M2

- **Owner:** review and apply `drizzle/0001_hard_brood.sql` (`pnpm db:migrate`), then run
  `pnpm test:db` with env set to confirm the isolation/seed/FK assertions against the live
  DB (they are compile-verified but not executed here).
- **Owner:** confirm the primary-active-journey decision stands (one active goal = one
  primary journey) before M2 wires ambition selection; no migration is needed for MVP.
- M2 (onboarding + ambition selection) can then build on the `ambitions` catalog,
  `setGoalAmbition`, and the existing goals model.

---

# Addendum — Post-Migration Verification (owner-requested)

> Additive section. The report above is preserved unchanged. This section records
> the attempted live verification of M1 and the exact blocker encountered.
> Verification date: 2026-10-12. No secrets, credentials, or `.env` contents are
> included anywhere below. No schema/code/policy was changed, and nothing was
> committed, pushed, or deployed.

## A. Outcome summary — BLOCKED (no database target configured)

The migration was **not applied** and the DB integration suite was **not executed**,
because the environment has **no configured database target**. This is the explicit
stop condition in the task ("If the target cannot be confidently identified, stop and
report the blocker"). Running `pnpm db:migrate` or `pnpm test:db` here would either
fail against an empty connection string or, worse, risk touching an unintended
database — neither is acceptable under the "development/test only, never production"
rule.

## B. Database target identification (no values printed)

Commands run (names/status only; values never shown):

| Check | Command | Result |
| --- | --- | --- |
| Env names set/missing | `pnpm check:env` | **All 7 missing**, incl. `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOW_DB_TESTS` |
| `.env.local` present? | `Test-Path .env.local` | **False** (existence checked; contents never read) |
| `.env` present? | `Test-Path .env` | **False** (existence checked; contents never read) |
| Process env set? | `[Environment]::GetEnvironmentVariable(...)` per name | **All missing** |
| Resolved migration URL length | `dotenv` load then read `DATABASE_MIGRATION_URL.length` | **0** (empty string) |

**Conclusion:** `drizzle.config.ts` resolves `DATABASE_MIGRATION_URL ?? ""` to an
**empty string**, so there is no identifiable database target — development, test, or
otherwise. The target **cannot be confidently identified**, so per the safety rules I
stopped before applying the migration or connecting to any database. **Database target
category: not determinable (no configuration present in this environment).**

## C. Static verification performed (no database required)

Because the live path is blocked, I verified everything that can be checked offline.
All passed:

1. **Migration ↔ journal consistency:** journal tags `0000_flawless_lilandra` and
   `0001_hard_brood` exactly match the files in `drizzle/`.
2. **Snapshot chain integrity:** `0001_snapshot.json.prevId` equals
   `0000_snapshot.json.id` (`4f60d737-…`). Chain is valid.
3. **Snapshot content:** `0001` snapshot contains `public.ambitions`, `public.goals`,
   `public.learner_profiles`; `goals` includes the new `ambition_id` column and all
   three indexes — including the preserved `goals_one_active_per_learner` (the
   primary-active-journey invariant is intact in the schema).
4. **Migration SQL review** (`drizzle/0001_hard_brood.sql`): additive and safe — new
   `ambitions` table; `goals.ambition_id` nullable column + FK `ON DELETE set null` +
   index; `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated` on
   `ambitions`. No destructive statements (no DROP/TRUNCATE/UPDATE of existing data).
5. **Regression checks (no DB):**
   - `pnpm test` → **PASS** (12 files, 75 tests).
   - `pnpm typecheck` → **PASS** (exit 0).
   - `pnpm lint` → **PASS** (exit 0, 0 warnings).
6. **Working-tree preservation:** `git status --short` shows the same 11 pre-existing
   modified files (plus M1's intended edits) and the same untracked set; nothing was
   reset, cleaned, stashed, reverted, or reformatted. No files were deleted.

## D. Verification assertions — status

The six live assertions could **not** be executed here (no DB). They are **implemented
as automated tests** in `tests/db-integration.test.ts` and are ready to run once a
development/test Supabase env is configured:

| Required assertion | Status here | Where it will be verified |
| --- | --- | --- |
| Learner can access own permitted records | ⏳ Not run (no DB) | `a learner can link their own goal…` |
| Learner A cannot read/modify B's goal | ⏳ Not run (no DB) | `learner A cannot read, modify, or link learner B's goal` |
| FK rejects unknown ambition id | ⏳ Not run (no DB) | `the goal→ambition foreign key prevents an unknown ambition_id` (expects SQLSTATE 23503) |
| ON DELETE SET NULL on ambition delete | ⏳ Not run (no DB) | `deleting a catalog ambition nulls the link on goals (set null)…` |
| `ambitions` inaccessible via Data API roles | ⏳ Not run (no DB) | `the Supabase Data API (anon key) cannot read the ambitions catalog` |
| One-active-goal constraint still enforced | ⏳ Not run (no DB) | existing `allows only one active goal…` test (unchanged) |

No assertion failed; none could run. Schema-drift checking (`drizzle-kit check`/`up`
equivalents) also requires a live `DATABASE_URL`/`DATABASE_MIGRATION_URL`, so it is
blocked for the same reason and was not attempted.

## E. Remaining limitations / required owner action

- **Provide a development/test Supabase environment** (`.env.local` with
  `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — and confirm it points
  at the **development/test** project, not production. Values must never be printed.
- Then, in order: `pnpm db:migrate` (apply `0001_hard_brood.sql`) → `pnpm test:db`
  (executes the six assertions against the real DB + two throwaway users A/B, which are
  auto-deleted). Re-confirm the applied-migrations journal and run the project's
  schema-drift check once a connection is available.
- Nothing else is blocking. The migration itself is reviewed, additive, and consistent.

---

*End of addendum. Verification is intentionally incomplete because no database target
is configured in this environment; no changes were made to proceed around that.*

---

# Closeout — Live DB Verification Passed (final M1 status)

> Additive closeout section. Everything above is preserved. This records the
> successful live verification and the final M1 state. No secrets, keys, URLs, or
> tokens are included. No schema/migration/RLS/application changes were made during
> closeout; nothing was committed, pushed, tagged, or deployed.

## F. Database integration tests — PASSED

- **Command:** `pnpm test:db -- --reporter=verbose`
- **Result:** **18 tests passed, 0 failed.**
- **Duration:** 54.36 seconds
- **Environment:** development/test Supabase project (`pnpm check:env` shows the six
  required names `set`; only `AI_PROVIDER_API_KEY` is `missing`, which is expected —
  it belongs to the later AI milestone). The migration `0001_hard_brood.sql` is
  applied; `drizzle/` contains exactly two migrations (`0000_flawless_lilandra`,
  `0001_hard_brood`), both Drizzle-managed.

**Earlier failure and resolution (history):** the first `pnpm test:db` attempt failed
in `tests/helpers/test-users.ts` at `createClient()` with "Invalid supabaseUrl: Must
be a valid HTTP or HTTPS URL." Diagnosis (read-only) traced it to a malformed
`NEXT_PUBLIC_SUPABASE_URL` value reaching the worker (supabase-js throws that exact
message only when the value is non-empty but not `http(s)://`). The variable **name**
and the **dotenv loader** were correct; the **value format** was the problem. The
Supabase/API configuration was corrected by the owner, after which the suite passes.
No code change was required for that fix.

## G. What the 18 passing tests actually establish

These are the behaviors proven against the real database (via the two throwaway
users A/B that the suite creates and auto-deletes):

1. **Own-record access** — a learner can link their own goal to a catalog ambition and
   read it back through a learner-scoped query.
2. **Cross-learner isolation** — learner A cannot read, modify, or link learner B's
   goal; B's goal stays unlinked after A's attempt; A's scoped list excludes B's goal.
3. **Idempotent catalog seed** — seeding from `content/` creates the row once and does
   not duplicate on re-run (verified by a raw count).
4. **Referential integrity (FK)** — inserting a goal with an unknown `ambition_id` is
   rejected by the database (SQLSTATE 23503).
5. **ON DELETE SET NULL** — deleting a catalog ambition nulls the goal's link and keeps
   the goal (does not cascade-delete learner data).
6. **Data API lockdown** — the anon role cannot read or insert into `ambitions` (RLS +
   revoke), and the same holds for `goals`/`learner_profiles` (existing tests).
7. **Primary-active-journey invariant** — the `goals_one_active_per_learner` partial
   unique index still enforces at most one active goal; concurrent activation conflicts
   (SQLSTATE 23505).
8. **Cascade delete** — deleting an auth user cascades to their profile and goals.

## H. Non-database checks (re-run at closeout)

| Command | Result |
| --- | --- |
| `pnpm test` | **PASS** — 12 files, **75 tests** (DB suite excluded here by design) |
| `pnpm typecheck` (`tsc --noEmit`) | **PASS** — exit 0 |
| `pnpm lint` (`eslint`) | **PASS** — exit 0, 0 warnings |

`pnpm build` was not run during closeout (it needs the marketing/dashboard env and is
not part of M1's DB verification); it remains covered by M15 release verification.

## I. M1 completeness review

- **Ambition catalog + goal↔ambition relationship:** implemented — `ambitions` table,
  `goals.ambition_id` nullable FK, `setGoalAmbition`/`listAmbitions`/`requireAmbition`,
  idempotent seed from `content/`. Verified live (items 1, 3).
- **Constraints / FKs / indexes match design:** yes — `goals_ambition_id_idx` added;
  FK `ON DELETE set null`; `goals_one_active_per_learner` preserved; ambitions CHECK
  constraints present in `schema.ts` and the `0001` snapshot. Verified live (items 4, 5, 7).
- **RLS + Data API restrictions follow conventions:** yes — `ambitions` has
  `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated`, matching
  `0000`. Verified live (item 6).
- **Learner ownership enforced in service + DB paths:** yes — `setGoalAmbition` scopes
  `UPDATE … WHERE id AND learner_id` and returns `NotFoundError` for foreign/missing
  goals; `learnerId` comes only from the verified session. Verified live (item 2).
- **Migrations remain Drizzle-managed:** yes — `db:generate`/`db:migrate`, journal +
  snapshots, no parallel migration system.
- **No AI provider / M2 onboarding introduced:** confirmed — a source scan found no
  OpenRouter/Gemini/`src/server/ai`/planner/mastery/onboarding/diagnostic/roadmap
  artifacts in `src/`. `AI_PROVIDER_API_KEY` remains unset (reserved for M10).

## J. Remaining limitations (honest scope of what is *not* yet proven)

- The 18 tests prove the **ambition-catalog and goal-link** isolation/constraints.
  They do **not** yet cover the future evidence tables (`learner_capabilities`,
  `attempts`, `misconceptions`, `roadmap_items`, `revision_items`, `projects`) — those
  are added and isolated-tested in M5/M6/M8/M9/M11.
- Full application security (auth end-to-end, CSP, AI boundaries) is **not** claimed as
  proven here; those are verified in their own milestones and in M15.
- `pnpm build` and `pnpm test:db` are both environment-dependent; the DB suite is now
  green in the configured dev/test env, and the production build is verified at M15.

## K. M1 status: READY TO CLOSE

M1 is complete and verified: schema, migration, RLS/revokes, ownership enforcement,
isolation, FK/SET-NULL, and the primary-active-journey invariant all pass against the
real database; unit tests, typecheck, and lint are green; no scope creep. Awaiting
owner approval to begin M2.

---

*End of M1 closeout.*




