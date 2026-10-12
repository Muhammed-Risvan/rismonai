# M0 Implementation Report — Foundations & Contracts

> Milestone **M0 only**. Prepared for owner review. No M1+ work was done.
> All commands were run from the repo root in PowerShell. No secrets, tokens,
> or `.env` contents appear in this report. Nothing was committed, pushed,
> tagged, or deployed.

Branch: `main` @ `112a013` · Date: 2026-10-12

---

## 1. Scope — M0 requirements implemented

Confirmed against `implementation-plan.md` §M0. Implemented exactly the M0
objective: *establish the pure-core skeleton, shared TypeScript/Zod contracts,
and the ambition catalog shape so later work builds against stable interfaces.*

| M0 requirement (from plan) | Status | Where |
| --- | --- | --- |
| `src/core/` module layout | ✅ Done | `src/core/**` |
| Core domain type: `CapabilityId` (branded ids) | ✅ Done | `src/core/identifiers.ts` |
| Core domain type: mastery states | ✅ Done | `src/core/mastery.ts` |
| Core domain type: `Attempt` | ✅ Done | `src/core/attempt.ts` |
| Core domain type: `Recommendation` | ✅ Done | `src/core/recommendation.ts` |
| `content/` schema (TS + Zod) for ambitions, competency maps, lessons, exercises, misconceptions | ✅ Done | `src/core/content/**` |
| Content **DAG validator** (pure; rejects cycles + dangling prerequisites) | ✅ Done | `src/core/content/dag.ts` |
| Seed Cloud Security Engineer competency map that loads & validates | ✅ Done | `content/**` |

**Acceptance criteria addressed:**
- ✅ *Validator passes on a seed competency map* — `tests/core/content.test.ts`.
- ✅ *Fails loudly on a cycle* — `tests/core/dag.test.ts` (direct + longer cycles,
  dangling, self-dependency, duplicate id).
- ✅ *All new modules pure (no DB/network/clock)* — enforced by
  `tests/core/purity.test.ts` (static scan) + review.
- ✅ *Completion condition: seed CSE map loads and validates; `pnpm test` green.*
- ✅ *Type-level contract checks* — `tests/core/contracts.test.ts`.

## 2. Architecture — contracts/boundaries established and why

- **`src/core/identifiers.ts`** — Branded id types (`CapabilityId`, `AmbitionId`,
  `ObjectiveId`, `LessonId`, `ExerciseId`, `MisconceptionId`). Compile-time guard
  against mixing id kinds. Pure; runtime constructors are identity casts. The
  learner id is deliberately **not** branded — the existing code passes
  `learnerId` as a plain `string` from the verified session; this preserves that
  convention (and the security boundary).
- **`src/core/mastery.ts`** — Single source of truth for the five mastery states
  (`unknown`, `untested`, `developing`, `mastered`, `revision-needed`) + a Zod
  enum. The *transition logic* is intentionally **not** implemented here (M5);
  this is only the closed set both core logic and UI will share.
- **`src/core/attempt.ts`** — The `Attempt` shape. Establishes the
  **injected-time convention**: `submittedAt: Date` is supplied by the caller so
  pure core logic never reads the clock. No `Clock` abstraction was added in M0
  because no M0 logic consumes time yet (avoids an unused abstraction — see §8).
- **`src/core/recommendation.ts`** — The `Recommendation` shape with a mandatory
  human-readable `reason` (enforces explainable personalization at the type level).
- **`src/core/content/**`** — Pure Zod schemas for the curriculum: capabilities
  (DAG nodes), objectives, lessons, exercises (with deterministic answer keys),
  misconceptions, plus the ambition + competency-map wrappers. Shape is validated
  by Zod; **semantic** integrity (prerequisite cycles/dangling refs) by `dag.ts`;
  the combined entry point is `validateCompetencyMap` in `validate.ts`.
- **`content/**`** — Repo-root curriculum data (per the M0 plan's `content/**`).
  A small, reviewed **seed** Cloud Security Engineer map (4 capabilities, 2
  objectives, 2 lessons, 2 exercises, 2 misconceptions) that validates on load.
  `content/index.ts` builds an `AMBITION_CATALOG` and **fails fast** if any entry
  is invalid, so a broken map never reaches a learner.
- **`@content/*` path alias** — Added to `tsconfig.json` and `vitest.config.mts`
  so repo-root curriculum is importable by the same convention as `@/*`. This is
  the only shared-infrastructure change and is additive.

**Boundaries honored:** routes/services/data layers were not touched; no DB, no
network, no AI, no clock reads. Pure logic is isolated under `src/core` and
`content`, matching `AGENTS.md` ("Mastery, planner and revision logic live only
in pure core modules … they never call the clock, network or database directly").

## 3. Files changed

**Added (all M0):**
- `src/core/index.ts` — core barrel.
- `src/core/identifiers.ts` — branded ids.
- `src/core/mastery.ts` — mastery states + enum.
- `src/core/attempt.ts` — Attempt contract (injected time).
- `src/core/recommendation.ts` — Recommendation contract.
- `src/core/content/primitives.ts` — shared Zod primitives (slug, date, semver, level).
- `src/core/content/schema.ts` — capability/objective/lesson/exercise/misconception schemas.
- `src/core/content/ambition.ts` — competency-map + ambition + catalog-entry schemas.
- `src/core/content/dag.ts` — pure prerequisite-DAG validator.
- `src/core/content/validate.ts` — combined Zod + DAG validation entry point.
- `src/core/content/index.ts` — content-contracts barrel.
- `content/index.ts` — ambition catalog (validates on load) + lookup.
- `content/cloud-security-engineer/index.ts` — seed CSE competency map.
- `tests/core/dag.test.ts` — DAG validator tests.
- `tests/core/content.test.ts` — seed-map + catalog + mastery-contract tests.
- `tests/core/contracts.test.ts` — domain-type shape + brand-constructor tests.
- `tests/core/purity.test.ts` — static purity guard (no DB/network/clock).
- `m0-implementation-report.md` — this report.

**Modified (minimal, additive, M0-justified):**
- `tsconfig.json` — added `@content` and `@content/*` path aliases (4 lines).
- `vitest.config.mts` — added `@content` resolve alias mirroring tsconfig (3 lines).

**Deleted:** none.

## 4. Existing changes preserved

The pre-existing working tree had **11 modified tracked files** and many
untracked files (the in-progress public-site work + blueprint docs). I did not
run `git reset/clean/checkout/stash` and did not revert or reformat anything.

- Final `git diff --stat` shows the **same 11 pre-existing modified files**
  (`README.md`, `docs/architecture.md`, `next.config.ts`, `package.json`,
  `pnpm-lock.yaml`, `src/app/dashboard/dashboard-client.tsx`,
  `src/app/dashboard/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`,
  `src/app/login/page.tsx`, `src/app/page.tsx`) **plus** my two intended files
  (`tsconfig.json`, `vitest.config.mts`). I verified my two diffs contain only
  the alias additions (§2/§3).
- All pre-existing untracked files remain untouched.
- Net new untracked paths from this task: `src/core/`, `content/`, `tests/core/`,
  and `m0-implementation-report.md`.

## 5. Tests and verification (exact commands + outcomes)

| Command | Result |
| --- | --- |
| `pnpm exec vitest run tests/core` | **PASS** — 4 files, 25 tests |
| `pnpm test` | **PASS** — 12 files, **75 tests** (was 50 before M0; +25 core) |
| `pnpm lint` | **PASS** — exit 0, 0 errors, 0 warnings |
| `pnpm typecheck` | **PASS** — exit 0 |
| `pnpm build` | **NOT RUN** (see §6) |

No regressions: all pre-existing test files still pass within `pnpm test`.

## 6. Build limitations

`pnpm build` was **not run** because it requires Supabase env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); without them,
Next.js fails while prerendering `/dashboard` (documented in
`repository-audit.md` §10 and `implementation-plan.md`). This is an
**environment limitation, not a code failure**, and is unrelated to M0 (M0 adds
no routes/pages). M0 correctness is fully covered by `pnpm test`,
`pnpm typecheck`, and `pnpm lint`, which all pass. A production build should be
verified in an env-configured context (Vercel, or locally with env set) before
release — that is part of M15.

`pnpm test:db` was not run (no live DB / env here); M0 adds no DB code, so this
does not affect M0.

## 7. Security review

- **No new runtime surface:** M0 adds only pure modules + data + tests. No
  routes, server actions, services, or DB access were added or changed.
- **Learner identity boundary preserved:** the `Attempt.learnerId` field is
  documented as sourced only from the verified session; M0 introduces no place
  that trusts a client-supplied id. No authorization logic changed.
- **No secrets:** no `.env` read/printed; no keys/tokens in code, tests, or this
  report. The reserved `AI_PROVIDER_API_KEY` was not touched; no AI provider was
  integrated.
- **RLS/migrations:** none added or altered (M0 has no schema changes).
- **Existing security model unchanged:** `requireLearner()`, service-layer
  `learnerId` scoping, and RLS remain exactly as before.

## 8. Outstanding issues / deviations / follow-ups

- **No `Clock` abstraction in M0 (deliberate).** The blueprint says to add an
  injectable clock "if explicitly required … and not already implemented." No M0
  logic consumes time, so I established the *injected-time convention* on the
  `Attempt` type instead of introducing an unused abstraction. A concrete clock
  (or injected `now` parameter) should be introduced with the first time-aware
  pure module in **M5 (mastery)**, where it has a demonstrated need.
- **Content schema is intentionally minimal.** It covers the M0-required shapes
  (capabilities, objectives, lessons, exercises, misconceptions, ambitions).
  Fields for later features (e.g. project specs, revision intervals, assessment
  branching) are deferred to the milestones that need them to avoid speculative
  schema. The M0 note ("finalize the content schema shape early") is honored at
  the structural level; expect additive, backward-compatible schema growth.
- **Answer-key matching is exact-string** by design for now; richer grading
  (normalization, choice items) is an M6 concern.
- No conflicts with existing code were found; no scope was expanded.

## 9. M1 readiness

M0 now provides, for M1 and beyond:
- Stable pure contracts: `CapabilityId`/branded ids, mastery states, `Attempt`,
  `Recommendation` (import from `@/core`).
- The `content/` schema + `validateCompetencyMap` + DAG validator, so M1's
  `ambitions`/catalog seeding and M4's content authoring have a validated shape
  to target (import from `@/core/content`).
- The `@content/*` alias and a load-time-validated `AMBITION_CATALOG`.
- A passing, extensible test layout (`tests/core/**`) and a purity guard that
  will keep future core logic honest.

**Prerequisite still unresolved for M1:** none blocking. M1 (learner data model:
`ambitions`, `learner_capabilities`, `attempts`, etc., with RLS + revokes +
cascade) can proceed. Reminder for M1: migrations are generated by the agent but
**applied by the human** after review, and every new table needs
`ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated`.

## 10. Scope confirmation

**M0 only.** No M1 or later milestone was implemented. Specifically, I did **not**
add: database tables or migrations, onboarding, signup, diagnostics, curriculum
content beyond the M0 seed, lesson pages, exercise grading, mastery calculations,
planners, revision scheduling, Gemini/AI integration, projects, dashboards,
gamification, or export/deletion. Those are later milestones. The existing
application's behavior is unchanged.

---

*End of M0 report. Awaiting owner review before starting M1.*



