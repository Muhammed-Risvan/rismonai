# Rismon.ai — Product & Engineering Specification

> Status: **proposed specification for review** — none of this is implemented. It defines
> how the system must *behave*, not just which technologies it uses. Companions:
> `brief.md`, `user-flows.md`, `implementation-plan.md`. Grounded in the current codebase
> and `AGENTS.md` rules.

---

## 1. Product principles and non-negotiable behavior

1. **Evidence over activity.** Mastery is granted only by recorded, graded evidence —
   never by viewing content, streaks, or time spent.
2. **AI proposes; deterministic code decides.** AI output is schema-validated and can
   **never** set mastery or override an answer key. Mastery/planner/revision are pure,
   tested code.
3. **Assess, don't assume.** Self-reported confidence is a hypothesis; capability comes
   from graded checks. Assisted (hinted) success ≠ independent mastery.
4. **Honesty.** Never display mastery, progress, or a completed project that isn't backed
   by recorded evidence. No job/salary/completion-date promises.
5. **Personalization must be real.** Recommendations carry a reason; two learners with
   different starting points get different paths. Never fake personalization.
6. **One thing at a time.** Short, focused interactions; connect foundations to practice.
7. **Fail safe.** AI/provider outages degrade gracefully; learner records are never
   corrupted; saved progress is always accessible.
8. **Learner owns their data.** Export and delete on request; strict per-learner isolation.

## 2. Current technology stack and architecture (verified)

Verified from `package.json` / `pnpm ls` and source (see `repository-audit.md` §3):

- **Next.js 16.4.0** (App Router, Turbopack, **Cache Components** `cacheComponents:true`,
  Partial Prefetching), **React 19.3.0**, **TypeScript 5.9.3** (strict), Node 24.20.0,
  pnpm 12.10.1.
- **Auth/DB:** Supabase Auth (`@supabase/supabase-js` 2.117.3, `@supabase/ssr` 0.12.7) +
  PostgreSQL.
- **Data:** Drizzle ORM 0.45.4 + Drizzle Kit 0.31.11 over `postgres` 3.4.9 (direct
  connection, `prepare:false`, `max:1`, lazy singleton).
- **Validation:** Zod 4.6.5. **Styling:** Tailwind 4.3.3 (tokens in `src/app/globals.css`).
- **3D:** three 0.186.1 + @react-three/fiber 9.8.1. **Tests:** Vitest 5.0.3 (two configs).
- **Hosting:** Vercel (`rismon.ai`). **No AI SDK installed.**

**Layering (must be preserved):** `UI/route → services → data access → pure core`.
Routes hold no business logic; services take `learnerId` first and enforce authorization;
data access holds all Drizzle queries; `src/core` holds pure mastery/planner/revision
(no DB/network/clock — time is injected). Error mapping in `src/server/http/route-errors.ts`
returns safe messages; `NotFoundError` never distinguishes "missing" vs "foreign."

**Caching:** dynamic by default; nothing cached unless it opts into `use cache`. Protected
session-reading routes (e.g. `/dashboard`) use `export const instant = false`. Do not
reintroduce removed `dynamic`/`revalidate` segment configs.

## 3. Proposed learning-system architecture

```
content/            # versioned curriculum data (ambitions, competency maps, lessons,
                    #   exercises, answer keys, misconceptions) — NOT runtime AI output
src/core/           # PURE, tested: mastery, planner, revision, gap analysis, roadmap
                    #   (no DB / network / clock; time injected)
src/server/
  ai/               # provider adapter + schema validation + failure handling
  services/         # learning services (attempts, mastery application, roadmap, projects)
  data/             # Drizzle queries for all new tables
  validation/       # Zod schemas at every boundary
src/app/(learning)/ # teaching UI, assessment UI, dashboard additions
```

Rules: content is **data**, versioned and reviewed; the engine is **ambition-agnostic**;
AI sits behind an adapter and only proposes; the frontend never computes mastery.

## 4. Database and data-ownership principles

- All new tables follow the existing pattern: `learnerId` (or a learner-scoped FK),
  timestamps, and **`ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated`**
  in the migration (per `AGENTS.md`). Service-layer `learnerId` scoping is the primary
  guard; RLS/revokes close the Supabase Data API path.
- Every new learner-scoped table has an `ON DELETE CASCADE` path back to the learner so
  account deletion is complete (mirrors existing `goals → learner_profiles` cascade).
- Schema changes **only** via reviewed Drizzle migrations (`pnpm db:generate` → human
  review → `pnpm db:migrate`). Never edit the schema in the Supabase dashboard.
- Curriculum/catalog content that is **not** learner-owned (ambitions, competency maps,
  lessons) is reference data; it may live as versioned files in `content/` and/or in
  catalog tables, but it is never per-learner and never invented at runtime.

## 5. Goal and learner-profile models

**Existing (preserve):** `learner_profiles` (id = auth user id, display_name ≤80,
timezone, timestamps) and `goals` (id, learner_id FK cascade, title 1–200, description
≤2000, target_outcome ≤500, status, deadline, hours_per_week, timestamps) with the
partial unique index `goals_one_active_per_learner` (one `active` goal per learner).

**Intended model (additive, backward-compatible):**
- Treat an **ambition** as a catalog entry (id, name, description, competency-map ref).
- Treat the learner's **goal** as their instance of an ambition (reuse `goals`). Add a
  nullable `ambition_id` linking a goal to a catalog ambition, so the engine knows which
  competency map applies. Existing rows remain valid (`ambition_id` nullable).
- **One primary active learning journey** at a time — already enforced by the existing
  "one active goal" invariant. **See §Migration note below** for the smallest safe change
  if we later want several concurrent active ambitions.

**Migration note (single-active-goal invariant) — documented, NOT performed now:**
The current partial unique index allows exactly one `active` goal per learner. The MVP
("one primary active journey") is satisfied **as-is**, so **no migration is required for
MVP**. If multiple concurrent active ambitions are later desired, the smallest safe change
is to add an explicit `is_primary` boolean with its own partial unique index
(`WHERE is_primary`) and relax the status-based one — but this must be a separate,
human-reviewed migration decided when that feature is actually in scope. **Do not change
it during preparation.**

## 6. Curriculum and competency-map requirements

- **Structured, versioned data** describing, per ambition: **capabilities** (nodes),
  **prerequisites** (edges), **objectives**, **lessons** (explanation, analogy, visual,
  example), **exercises** (with answer keys), **assessment rules**, **known
  misconceptions** (signature → remediation), and **practical projects**.
- **Validation:** prerequisite relationships must form a **DAG** — a pure, tested function
  detects cycles and dangling references at content-load time (fails the build/tests, not
  at runtime for learners).
- **Appropriateness:** content is tagged to the ambition and to a level; the planner only
  serves content matching the learner's ambition and readiness.
- **No AI-invented roadmaps.** The topic structure comes from the reviewed map; AI may
  rephrase or add examples but never defines the curriculum.
- **Accuracy review:** a documented process + owner sign-off to review curriculum against
  current professional requirements before release and on a recurring cadence. Content
  carries a version + "last reviewed" date.

## 7. Diagnostic and assessment behavior

- **Adaptive:** item selection is deterministic pure logic; answers branch the next item.
- **Graded by answer keys**, producing a capability level per probed capability.
- **Coverage gate:** a roadmap is generated only after minimum diagnostic coverage, or the
  learner explicitly opts to "start at beginner" (recorded as `unknown`, not assumed).
- **Resumable:** completed items persist; the learner resumes at the next unanswered item.
- **Reassessment** is always possible; history is preserved (never overwritten silently).

## 8. Lesson and exercise structure

- **Lesson:** one concept; why-it-matters, analogy, visual, worked example; optional
  validated AI variant. Viewing never sets mastery.
- **Exercise:** typed items with a deterministic answer key. Two modes — **guided**
  (hints allowed; success recorded as **assisted**) and **independent** (no hints; a pass
  is mastery evidence).
- **Feedback:** on a wrong answer, point at the specific gap; if it matches a known
  misconception signature, record it and schedule revision; otherwise honest "not yet" +
  correct reasoning.
- Every submission persists an attempt: mode, item, answer, correctness, hints-used,
  timestamp.

## 9. Evidence-based mastery rules

- **States:** `unknown`, `untested`, `developing`, `mastered`, `revision-needed`.
- **Pure functions** in `src/core` compute transitions from attempt evidence; **time is
  injected**; transitions are explicit, explainable, and unit-tested.
- **Assisted ≠ independent:** hinted success → at most `developing`; only an independent
  pass → `mastered`.
- **Explainability:** the system can state *why* a capability is at its current level
  (which attempts/evidence produced it).
- **AI can never** change a mastery state or an answer key.

## 10. Misconception tracking and revision

- A wrong answer matching a known misconception signature creates a **misconception
  record** (open). Unknown signatures produce generic feedback (and may be candidates for
  new content, reviewed by a human — never auto-added as fact).
- Misconceptions + `revision-needed` capabilities feed a **spaced revision queue** (pure
  scheduling; time injected). Due items surface before new content.
- A fresh **independent** pass clears a misconception and can confirm `mastered`; failing
  again re-records and reschedules (possibly escalating to a prerequisite). The learner is
  never hard-blocked from new material.

## 11. Adaptive planning and recommendation explanations

- A **pure planner** selects the next activity from prerequisite readiness, demonstrated
  weaknesses, due revisions, the active ambition's map, and available study time.
- Each recommendation includes a **reason string**. Planning logic is unit-tested
  independently of any AI provider.
- The planner never fabricates personalization: if the path would be identical for
  everyone, that is a content/engine issue to fix, not something to disguise.

## 12. AI integration, boundaries, validation, and failure handling

- **Provider adapter** (`src/server/ai/`) so the app is not coupled to one provider.
  **First planned provider: OpenRouter** (confirmed). OpenRouter is an API aggregator
  that fronts many models behind one key + OpenAI-compatible API, which lets us add or
  swap models without changing learning logic. **No AI SDK is installed today**; the
  provider + client choice is made in the AI milestone (M10) with alternatives
  documented before any dependency is added (per `AGENTS.md`).
- **Multi-provider by design:** the adapter exposes a small task-oriented interface
  (e.g. `explainConcept`, `suggestExample`, `reviewProject`); adding a provider or
  model means adding an adapter implementation + config, never touching core learning
  logic. Learning logic (mastery, planner, grading) never calls a provider directly.
- **Reserved env:** `AI_PROVIDER_API_KEY` already exists in `.env.example` (unused).
  Secrets stay server-side; never logged; configured the same safe way as existing env.
  *(Secure API-key management, model discovery, connection testing, task-based routing,
  usage controls/cost caps, and controlled fallback are designed in M10 — see the plan.)*
- **Scope of AI (MVP):** bounded, validated proposals only — an alternative explanation,
  an extra example, practice-item wording, or project review feedback. **No free-form
  tutoring chat in MVP.** AI never sets mastery, never defines curriculum, never
  overrides answer keys.
- **Validation:** every AI response is parsed against a **Zod schema**; on failure it is
  discarded and a deterministic fallback is used. Output is never partially applied.
- **Failure handling:** timeouts, malformed responses, rate limits (429), and outages
  are caught; backoff/circuit-breaker prevents hammering; the learner sees a neutral
  message and continues with deterministic content. **Learner records are never
  corrupted and saved progress stays accessible during an outage.**
- **Deterministic authority preserved:** an AI response is **never the sole authority**
  for mastery or grading. Curriculum facts and mastery decisions come from trusted
  content + deterministic rules; AI only proposes, and validated code decides.
- **Grounding:** curriculum facts and mastery decisions come from trusted content +
  deterministic rules, not from the model.

## 13. Gamification and 3D brain data integration

- **Gamification is meaningful, not childish:** progress reflects demonstrated capability
  (mastery states, cleared misconceptions, completed projects). No rewards for mere activity
  (views, logins, streaks without evidence). Optional: capability milestones tied to real
  mastery.
- **3D brain:** the existing decorative hero (`src/components/brain`, pure deterministic
  geometry) is extended with an optional **learner-data mode** visualizing real saved
  capability/mastery (e.g. regions brighten as related capabilities reach `mastered`). It
  **reads persisted state only**, **never invents progress**, and is **never the source of
  truth**. With no learner data (marketing/`/`) it stays decorative exactly as today. Keep
  the performance rules (client-only, `ssr:false`, offscreen/hidden pause, reduced-motion,
  SVG fallback).
- The frontend **never computes mastery**; it only renders server-provided state.

## 14. Authentication, authorization, privacy, and security

- **Auth:** Supabase SSR cookies; `src/proxy.ts` refreshes the session; `requireLearner()`
  (`auth.getUser()`) is the sole identity source. **`getSession()` is never used for
  authorization.** `learnerId` comes only from the verified session and is passed first to
  every service. Browser-supplied learner ids are rejected (strict Zod).
- **New-auth decision (owner):** MVP needs either **public signup** (a new `signUp` server
  action mirroring the safe `signInAction`) **or** a documented **manual provisioning**
  path. **Flagged, not assumed** — see §22.
- **Authorization/isolation:** every new query is `learnerId`-scoped; foreign/missing →
  identical `NotFoundError`. New tables get RLS + revokes. Cross-learner isolation is covered
  by an automated two-account test (extends the existing DB-integration pattern).
- **Privacy:** data export + account deletion (user-initiated, re-confirmed). Privacy/terms
  pages (currently DRAFT) must be updated to describe learning data, AI processing, and
  retention **before** those features go live.
- **Secrets:** server-side only; never logged; `.env*` never read by agents (use
  `pnpm check:env`). Service-role key stays confined to `tests/helpers/`.
- **Headers:** existing four headers remain; add a **Content-Security-Policy** before
  shipping AI/more client script (WebGL makes this non-trivial — plan it).

## 15. Accessibility, responsiveness, and design conventions

- **Reuse the existing design system** (`src/components/ui` + tokens in `globals.css`);
  light/dark via `prefers-color-scheme`. No new UI library.
- **Accessibility:** semantic headings, keyboard-accessible controls, visible
  `:focus-visible` rings, `aria` on interactive/dynamic regions (live feedback, progress),
  `prefers-reduced-motion` respected, WCAG-AA contrast (existing tokens comply).
- **Responsive:** mobile-first; the teaching interface must work on a phone (short
  interactions, large touch targets).
- **Conventions:** routes thin; Zod at boundaries; safe error mapping; PowerShell-friendly
  commands; small reviewable changes; tests for all learning logic.

## 16. Testing strategy

- **Pure core** (mastery, planner, revision, gap analysis, roadmap, prerequisite-DAG
  validation): exhaustive **unit tests** in `tests/` (Vitest), including edge cases
  (assisted vs independent, cycles, time injection, "identical path" detection).
- **Services/routes:** unit tests with mocked auth (mirror `routes-unauthenticated.test.ts`,
  `require-learner.test.ts`, `validation.test.ts`).
- **DB integration** (`pnpm test:db`, gated by `ALLOW_DB_TESTS`): persistence, cascade
  delete, and **two-account isolation** for every new learner-scoped table (mirror the
  existing `db-integration.test.ts` throwaway-user pattern).
- **AI adapter:** tests with a fake provider for success, malformed output, timeout, 429,
  and outage → deterministic fallback, no record corruption.
- **Content:** a test that loads each ambition's map and asserts the prerequisite graph is a
  valid DAG with no dangling refs.
- **Build/type/lint:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` must pass
  (build requires env — see release verification).

## 17. Data export, deletion, and reset behavior

- **Export:** server-generated, learner-scoped, machine-readable (profile, ambitions/
  roadmap, capability levels, attempts, misconceptions, projects). Authenticated; never
  includes another learner's data.
- **Deletion:** user-initiated with re-confirmation; deleting the auth user cascades to all
  learner-scoped tables (new tables must define `ON DELETE CASCADE` to the learner). Stated
  as irreversible.
- **Reset (optional, distinct from delete):** reset *progress* (attempts/mastery) while
  keeping the account — scoped deletes of learning tables, never touching profile/auth.
  **Confirm with owner whether in MVP scope.**

## 18. Migration and backward-compatibility rules

- All schema changes via **reviewed Drizzle migrations**; human applies with `pnpm db:migrate`.
- **Additive/backward-compatible:** new tables and **nullable** columns (e.g.
  `goals.ambition_id`) keep existing rows and the current dashboard working. No destructive
  changes without an explicit, reviewed data-migration plan.
- Every table-creating migration includes RLS + revokes. Keep migrations reproducible;
  hand-edit only what Drizzle can't express (as the existing migration does for the
  `auth.users` FK and RLS).
- Preserve existing tests and functionality; run the full check suite after each migration.

## 19. Coding-agent constraints (for Cline / any AI agent)

- Follow `AGENTS.md` and `docs/architecture.md`. Routes hold no business logic; services
  take `learnerId` first; identity only from the verified session.
- **Mastery/planner/revision live only in `src/core` as pure, tested modules** (no DB,
  network, or direct clock; time is injected).
- **AI output is validated and can never set mastery or override answer keys.**
- New tables: reviewed Drizzle migration + RLS + revokes; never edit schema via dashboard.
- No new framework/ORM/AI-SDK/dependency without a documented justification + owner
  approval. No secrets in code/logs; never read `.env*` (use `pnpm check:env`).
- Add/update tests for all learning logic; run `lint`/`typecheck`/`test` and report real
  output. Keep changes small and reviewable; stay within the current milestone. Humans run
  git/deploy.

## 20. Acceptance criteria for the first release

The release candidate is acceptable only when **all** of the following are true (verified,
not assumed):

1. A new learner can **create/sign in** (or use the documented provisioning path), complete
   onboarding + baseline diagnostic, and receive a **personalized** Cloud Security Engineer
   roadmap that **differs** from an experienced learner's.
2. The learner can work through **lessons + guided exercises + independent assessments**;
   submissions are graded deterministically; **attempts persist** across sessions.
3. **Mastery** updates only from evidence; assisted success never yields `mastered`; the UI
   shows a level only when backed by a recorded passed assessment.
4. **Misconceptions** are detected, stored, resurfaced in revision, and can be cleared by an
   independent pass.
5. The **planner** recommends a next activity **with a reason**, prioritizing due revision;
   its logic is unit-tested independent of AI.
6. At least one **guided practical project** can be completed with recorded evidence; it is
   shown complete only when its deterministic criteria are met.
7. The **dashboard + 3D brain** reflect real saved data; no invented progress; the brain
   still works decoratively on `/`.
8. **Goal/ambition management** works (primary journey, pause/switch) with **evidence
   preserved** across switches.
9. **Data export** and **account-data deletion** work and are complete (cascade verified).
10. **Security:** two-account isolation test passes; RLS + revokes on every new table;
    learner id only from the session; secrets never logged.
11. **AI resilience:** with the provider forced to fail (timeout/429/malformed/outage), the
    app stays usable, records are uncorrupted, and saved progress is accessible.
12. **Quality gates:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, and a
    production `pnpm build` all pass; a **CSP** is in place if AI/client-script shipped.
13. **Docs:** privacy/terms updated to describe learning data + AI processing; a
    **release/deploy verification** runbook exists and has been followed.

## 21. Explicit non-goals (first release)

No job/salary/completion-date guarantees; no free-form AI chat; no additional complete
ambitions beyond Cloud Security Engineer; no certifications; no social/leaderboard/teams/
payments/mobile apps; no claim of covering every cloud provider or specialty.

## 22. Open decisions requiring the owner (flagged, not assumed)

1. **Signup:** public self-serve vs. documented manual provisioning for the beta?
2. **AI provider + SDK:** which one (cost, rate limits, data retention, region)? None is
   installed; adding one needs approval.
3. **Multiple concurrent active ambitions:** keep the existing "one active goal" invariant
   (MVP) or plan the `is_primary` migration later?
4. **Reset-progress** feature: in MVP scope or later?
5. **Curriculum depth for release:** confirm the exact first-arc boundary (which objectives
   + how many projects) so scope is honest and achievable.

---

*End of specification. Consistent with `brief.md`, `user-flows.md`, and
`implementation-plan.md`. Nothing here is implemented; all capabilities are proposed.*



