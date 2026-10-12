# Rismon.ai — Product Brief

> Status: **proposed blueprint for review** — nothing here is implemented yet.
> Grounded in `repository-audit.md` and the current codebase (Next.js 16, React 19,
> TypeScript, Supabase Auth + Postgres, Drizzle, Tailwind, Vitest). See `spec.md` for
> the engineering specification, `user-flows.md` for journeys, and
> `implementation-plan.md` for the milestone sequence.

## 1. Vision and mission

**Vision.** Rismon.ai is a personalized AI mentor that turns a learner's ambition into
*demonstrated, real-world capability* — not course completions or streaks.

**Mission.** Guide a learner from where they actually are to where they want to be by:
understanding their starting point, teaching one useful concept at a time, having them
*practise and prove* each skill, remembering what they got wrong, and always knowing
the single best next thing to do.

Rismon behaves like a thoughtful senior professional: it explains *why* something
matters, prioritizes what is most useful, avoids overwhelming lessons, and connects
foundations to practical work. It builds genuine independence and measurable competence
— and it is honest about what the learner can and cannot yet do.

## 2. Target audience

Primary (first release): a **self-motivated beginner** pursuing **Cloud Security
Engineer** with **limited or no programming experience**, studying part-time, who wants
a structured, honest path from zero to job-ready competence.

Secondary (later): career-changers and juniors in adjacent ambitions — Software
Engineer, Penetration Tester, and others — and learners with prior experience who need
a personalized, evidence-based path rather than a generic course.

## 3. Core user problem

Existing tools optimize for *feeling* productive: videos watched, lessons finished,
days-in-a-row. None of that proves the learner can **do** the thing. They also hand
everyone the **same generic curriculum**, ignore prior knowledge, forget mistakes, and
cannot tell the learner what to work on next or why. Result: learners spend time on the
wrong things, carry unaddressed misconceptions, and cannot demonstrate competence.

## 4. Main differentiator

Rismon keeps a **persistent, evidence-based model of the learner** and uses it to drive
a **personalized journey over time**:

- It **assesses** real capability rather than trusting self-reported confidence.
- It records **attempts, evidence, and the specific misconception** behind a wrong
  answer, and resurfaces them later.
- It **explains why** it recommends the next activity.
- **Deterministic, tested code** validates answers and owns mastery state. AI only
  *proposes* (explanations, extra practice); it never sets mastery or overrides keys.

## 5. Five essential capabilities (MVP)

1. **Adaptive onboarding + baseline diagnostic** — discover ambition, experience,
   constraints, and starting capability (assessed, not just self-declared).
2. **Personalized roadmap** — a SMART, gap-driven Cloud Security Engineer journey from
   a reviewed competency map (never an AI-invented topic list).
3. **Focused teaching + interactive practice** — one concept at a time: short
   explanation, understanding checks, guided exercise, independent challenge.
4. **Evidence-based mastery + misconception memory** — attempts, evidence, and
   misunderstandings recorded; mastery, revision, and the "next activity" planner are
   pure, tested logic.
5. **Meaningful progress visualization** — dashboard + 3D brain wired to *real* saved
   skill data (no invented progress), plus guided practical projects.

## 6. Initial journey: Cloud Security Engineer

The first complete, coherent journey. Scope is deliberately bounded and honest:

- **Starts at true beginner** (limited or no programming experience).
- Built from a **hand-authored, reviewed competency map** with explicit objectives,
  prerequisites, explanations, exercises, assessment rules, known misconceptions, and
  practical applications — stored as **versioned structured data**, not generated at
  runtime by an AI model.
- Enough reviewed content to deliver a **complete first arc** (foundations → core cloud
  security concepts → a guided practical project) rather than an empty shell.
- It does **not** claim to cover every cloud provider, every certification, or every
  career path. Boundaries are stated in the roadmap and in `spec.md`.

## 7. Long-term support for other ambitions

The product must support different ambitions **without** forcing every learner through
the same curriculum:

- **Ambitions are catalog data** (e.g. Cloud Security Engineer, Software Engineer,
  Penetration Tester), each with its own competency map and content.
- The learning engine (mastery, planner, revision, assessments) is **ambition-agnostic
  pure logic**; only curriculum and competency maps are ambition-specific.
- A learner can hold **multiple saved ambitions** with **one primary active learning
  journey** at a time; **learning evidence is preserved** when they switch.
- Adding a new ambition = adding a new reviewed catalog entry + content, with no engine
  changes.

## 8. Product principles

1. **Evidence over activity.** A topic counts only when the learner can *prove* it.
2. **Honesty.** State plainly what the learner can and cannot yet do; never fake mastery
   or completed projects; never promise a job, salary, or a completion date.
3. **One thing at a time.** Short, focused interactions beat overwhelming lessons.
4. **Remember the mistake.** A wrong answer is data: record the specific
   misunderstanding and bring it back.
5. **AI proposes; deterministic code decides.** AI never sets mastery or overrides
   answer keys; its output is validated.
6. **The learner owns their data.** Export and delete on request; secure isolation.
7. **Reuse the foundation.** Build on the existing auth, layering, design system, and
   tests; do not rewrite the app.

## 9. Explicit MVP scope (first release)

**In scope (must exist for a usable first release):**

- Account creation **or** a clearly documented manual account-provisioning path (owner
  decision — see `spec.md` §Authentication).
- Authentication + persistent learner profile (extends existing).
- Ambition selection (Cloud Security Engineer) + adaptive onboarding questionnaire.
- Baseline diagnostic that *assesses* starting capability.
- Personalized, SMART roadmap generated from the reviewed competency map.
- A complete learning interface: structured lessons + interactive exercises + independent
  challenges, one concept at a time.
- Persistent attempt history; evidence-based mastery with misconception tracking.
- A next-activity planner + revision/misconception-recovery workflow, with explanations.
- At least one guided practical project with portfolio-style evidence.
- Dashboard + 3D brain connected to **real** saved skill data.
- Goal/ambition management (primary journey, pause/switch, preserving evidence).
- Data export + account-data deletion (user-initiated).
- Secure per-learner data isolation; graceful handling of AI/provider failures.
- Automated tests + verified production build + documented release/deploy verification.

**Out of scope for MVP (future):**

- Multiple complete ambitions beyond Cloud Security Engineer (engine supports them;
  content does not yet exist).
- Live AI tutoring conversations / free-form chat (MVP uses bounded, validated AI
  proposals only — see `spec.md`).
- Certifications, job guarantees, salary claims, completion-date promises.
- Social features, leaderboards, teams, mobile apps, payments.
- Full coverage of every cloud provider or niche specialty.

## 10. Definition of a usable first release

A real learner can, end to end, **without engineer help**:

1. Create/sign in to an account and complete onboarding + baseline diagnostic.
2. Receive a personalized Cloud Security Engineer roadmap reflecting their real starting
   point (a total beginner and an experienced learner get visibly different plans).
3. Work through lessons and exercises; submit answers; see honest, evidence-based
   feedback; have attempts and misconceptions saved.
4. Get a sensible "what to do next" recommendation with a reason, and revisit
   misconceptions via revision.
5. Complete a guided practical project that produces real evidence.
6. See accurate progress on the dashboard and 3D brain that matches their saved data.
7. Export their data and delete their account data.
8. Do all of the above with secure isolation, and with the app remaining usable even if
   the AI provider is down (degraded, deterministic fallback).

## 11. Measurable success criteria

**Learning-quality (primary):**
- A beginner can complete the first coherent arc and **demonstrate** core capabilities
  via independent assessment (not just viewed lessons).
- The roadmap **differs** between a zero-experience learner and an experienced one
  (proves real personalization, not a fixed path).
- Misconceptions detected during practice **reappear** in revision and are later passed
  independently.

**Engagement (secondary, never gamed):**
- Returning learners complete a recommended next activity in most sessions.
- Median session length stays in "short, focused" range (indicates right-sized content).

**Trust & integrity:**
- **Zero** instances of displayed mastery not backed by a recorded passed assessment.
- **Zero** cases where an AI response altered mastery or an answer key.
- Cross-learner data isolation test passes (no learner can read another's data).

**Operational:**
- Production build passes; `pnpm lint`, `pnpm typecheck`, `pnpm test` green; DB
  integration tests pass; AI-provider outage leaves the app usable with saved progress
  intact.

---

*End of brief. Cross-references: `user-flows.md` (journeys), `spec.md` (engineering
spec + acceptance criteria), `implementation-plan.md` (milestones). All four are
consistent; none of the capabilities above exist in the codebase today.*

