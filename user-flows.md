# Rismon.ai — User Flows

> Status: **proposed blueprint for review** — none of this is implemented. These are
> intended journeys and decision branches. Companion to `brief.md`, `spec.md`, and
> `implementation-plan.md`. Existing routes today are only `/`, `/login`, `/dashboard`,
> the marketing pages, and `/api/{health,profile,goals}` (see `repository-audit.md`).

**Convention.** "Persist" = write to Postgres so it survives refresh/new sessions.
"Assess" = a deterministic, graded check (not self-report). "AI-proposed" = output that
must be schema-validated and can never set mastery. Every authenticated step derives
identity from the server-verified session (`requireLearner()`); the browser never
supplies a learner id.

---

## 1. First visit and account creation

1. Visitor lands on `/` (marketing). CTAs: "Request access" and "Sign in".
2. **Account creation:**
   - If public signup is enabled: an `/signup` route collects email + password via a
     server action (`supabase.auth.signUp`), mirroring the existing safe `signInAction`
     pattern (generic errors, secret-safe logging).
   - If public signup is intentionally deferred for the beta: the flow routes to a
     documented **manual provisioning** path (owner creates the account; learner only
     signs in). **Owner decision — see `spec.md` §Authentication / §16.**
3. On success, the session cookie is set and the learner is sent to **onboarding**
   (not straight to the dashboard) if onboarding is incomplete; otherwise to `/dashboard`.
4. **Branch — email already registered / wrong password:** generic error (never reveal
   whether the account exists), stay on the form.
5. **Persist:** nothing yet beyond the auth user; profile row is created lazily by the
   existing `ensureProfile()` on first authenticated request.

## 2. Goal selection and clarification

1. Learner is asked to **choose an ambition** from the catalog (MVP: **Cloud Security
   Engineer**; later: Software Engineer, Penetration Tester, …).
2. **Clarify the intended outcome** in the learner's own words (e.g. "get a first cloud
   security job", "secure my team's AWS estate"). This maps onto the existing `goals`
   row (`title`, `target_outcome`).
3. Capture **SMART inputs** the existing goal fields already support: `deadline`,
   `hours_per_week`. Rismon does **not** promise a completion date or a job.
4. **Branch — ambition not yet supported:** show an honest "this journey is being built"
   message and (optionally) a waitlist; do not fabricate a roadmap.
5. **Persist:** an ambition/goal record with `status` derived by the server (existing
   `createGoal` sets `active` if none active, else `paused`). This becomes the **primary
   active learning journey**.

## 3. Adaptive onboarding

Purpose: discover starting knowledge, experience, constraints, and resources **before**
planning. Adaptive = later questions depend on earlier answers (e.g. if "no programming
experience," skip advanced items and add a foundations primer).

1. Short, one-topic-at-a-time questions (reuse the focused-interaction pattern):
   - Background: current role, years of IT/tech exposure.
   - Programming: none / some / comfortable (drives branching).
   - Cloud exposure: none / basic / hands-on (AWS/Azure/GCP).
   - Security exposure: none / some / professional.
   - Constraints: `hours_per_week`, target `deadline`, preferred pace.
   - Resources: access to a cloud free tier? a lab environment? (affects projects).
2. **Self-reported answers are stored as a *hypothesis*, not as mastery** (per product
   principles). They seed the diagnostic; they never set capability levels.
3. **Branch — interruption:** onboarding is resumable; partial answers persist and the
   learner is returned to the next unanswered question on re-entry.
4. **Persist:** onboarding responses (as `onboarding_answers`, scoped by `learnerId`).

## 4. Baseline diagnostic

Purpose: **assess** real starting capability instead of trusting self-report.

1. A short adaptive set of graded items drawn from the competency map's entry-level
   capabilities (mix of conceptual checks and, where feasible, small applied tasks).
2. Items are **adaptive**: strong early answers can skip ahead; weak answers branch to
   foundational probes. Deterministic item selection (pure core logic).
3. Each item is graded by deterministic rules (answer keys), producing a **capability
   level** per probed capability.
4. **Branch — abandoned mid-diagnostic:** completed items persist; on return, resume from
   the next unanswered item. Do **not** generate a roadmap until the diagnostic reaches a
   minimum coverage threshold (see §5) — or offer an explicit "skip and start at
   beginner" that records everything as `unknown` (honest, not assumed).
5. **Persist:** diagnostic attempts + resulting initial capability levels. These levels
   are the *starting state* the roadmap is built against.

## 5. Personalized roadmap creation

1. Pure core logic compares the learner's **assessed capability levels** against the
   Cloud Security Engineer **competency map**, computes **gaps**, and orders work by
   prerequisites + gap size + available `hours_per_week`.
2. The result is a **SMART roadmap**: a sequenced set of objectives (specific, measurable,
   achievable, relevant, time-bound against the learner's own inputs) — with **no promised
   completion date**.
3. **Personalization proof:** a zero-experience learner and an experienced learner receive
   **visibly different** roadmaps. The roadmap is generated from the reviewed map,
   **never** by asking an AI model to invent a topic list.
4. **Branch — re-run:** if inputs change materially, the roadmap can be regenerated;
   **existing mastery/evidence is preserved** and already-mastered capabilities are not
   reset.
5. **Persist:** the roadmap (ordered objective list) + its link to the active ambition.

## 6. Learning a concept

1. Learner opens the recommended objective → the **next lesson/step** for it.
2. A lesson presents **one concept at a time**:
   - A short explanation of *why it matters* and what it is.
   - A memorable analogy and a visual/diagram.
   - A concrete practical example.
   - (Optional) an **AI-proposed** extra example or rephrasing — schema-validated,
     clearly secondary, never required to progress.
3. **Branch — AI failure:** the hand-authored explanation always renders; AI extras are
   omitted. The learner can always continue.
4. **Branch — too advanced / confused:** the learner can flag "explain differently" or
   "show a simpler example" (may re-request an AI-proposed variant or step back to a
   prerequisite). Viewing content never affects mastery.
5. **Persist:** lesson viewed (progress signal only — **viewing never sets mastery**).

## 7. Guided practice and independent assessment

Two distinct modes with different grading weight:

1. **Guided exercise:** hints available; the learner builds toward the answer. Correct
   after substantial hints is recorded as **assisted** — it does **not** count as
   independent mastery.
2. **Independent challenge / assessment:** no hints; graded deterministically against the
   answer key. A pass here is the evidence that can raise mastery to `mastered`.
3. **Understanding checks** (short in-lesson questions) feed misconception detection but
   alone do not confer mastery.
4. **Branch — wrong answer:** deterministic feedback points at the *specific* gap; if the
   response matches a **known misconception** signature, that misconception is recorded and
   scheduled for revision (§10); otherwise an honest "not yet" + correct reasoning is shown.
5. **Persist:** every attempt (mode, item, answer, correctness, hints-used, timestamp).

## 8. Recording attempts and updating mastery

1. On each submission, the service records the attempt, then calls a **pure mastery
   function** (`src/core`) that updates capability state from attempt evidence. The current
   time is **passed in** (the core never reads the clock).
2. Mastery states: `unknown`, `untested`, `developing`, `mastered`, `revision-needed`.
   Transitions are explicit, explainable, and unit-tested.
3. **Assisted ≠ independent:** hints-used attempts move a capability toward `developing`
   at most; only independent passes reach `mastered`.
4. **AI never sets mastery.** AI output is validated and used only as a proposal; the
   deterministic rule owns the state change.
5. **Persist:** capability state + full attempt history (reassessable). Nothing here is
   computed in the frontend.

## 9. Choosing the next activity

1. A **pure planner** (`src/core`) selects the next activity from: prerequisite readiness,
   demonstrated weaknesses, revision needs (due items), the active ambition's map, and
   available study time (`hours_per_week` / session length).
2. Every recommendation carries a **human-readable reason** ("Your IAM basics are solid;
   next we'll cover X because your roadmap needs it before Y"). This avoids the illusion of
   personalization when the path would otherwise be identical for everyone.
3. **Branch — nothing due:** recommend the next unstarted objective or a project; never pad
   with busywork.
4. **Persist:** the recommendation is computed on demand (not stored as truth); the
   underlying evidence is what persists.

## 10. Revision and misconception recovery

1. Recorded **misconceptions** and `revision-needed` capabilities enter a **spaced revision
   queue** (pure scheduling logic; time injected).
2. When a revision item is due, the planner surfaces it **before** new content, framed as
   "let's revisit something you found tricky."
3. A revision item is a fresh, independent check. Passing it independently clears the
   misconception and can restore/confirm `mastered`.
4. **Branch — fails again:** the misconception is re-recorded (possibly escalated to a
   prerequisite review) and rescheduled; the learner is never blocked from new material if
   they choose.
5. **Persist:** misconception records (open/cleared), revision schedule, and outcomes.

## 11. Practical projects and portfolio evidence

1. At defined points, the roadmap recommends a **guided practical project** (e.g. harden a
   small cloud environment) exercising several capabilities together.
2. The project has steps, acceptance criteria, and a place for the learner to record what
   they did and link evidence (their own notes/artifacts).
3. Completion requires meeting the project's **deterministic acceptance criteria** (e.g. a
   checklist the learner confirms + any automated checks). AI may *suggest* review feedback
   but cannot mark a project complete on its own.
4. **Honesty rule:** a project is shown complete **only** when its criteria are recorded as
   met. Never display a completed project that isn't.
5. **Persist:** project progress + learner-attached evidence (portfolio-style).

## 12. Dashboard and visual skill progression

1. The dashboard shows: active ambition + SMART roadmap progress, current capability
   levels (real, from saved mastery), due revision items, the recommended next activity
   (with reason), and completed projects.
2. **3D brain:** the existing hero visual is extended to optionally reflect **real saved
   skill data** (e.g. nodes/regions brighten as related capabilities reach `mastered`). It
   reads persisted state; it **never invents progress** and is **never the source of
   truth**. When there is no learner data (marketing/`/`), it stays decorative as today.
3. Progress is always traceable to recorded evidence; no percentage is shown that isn't
   backed by assessments.
4. **Persist:** the dashboard reads persisted state; it stores nothing new.

## 13. Returning learner experience

1. On sign-in, the learner lands on the dashboard and sees a single clear **"continue
   here"** recommendation with its reason.
2. Due revision items are surfaced first, then the next roadmap activity.
3. State (roadmap position, mastery, misconceptions, projects) is fully restored from
   persistence — nothing depends on the previous browser session.
4. **Branch — long gap:** revision is prioritized to rebuild readiness before new content.

## 14. Pausing, changing, or adding ambitions

1. Learner can **pause** the active journey (existing goal `active → paused` transition),
   **switch** the primary active journey, or **add** another ambition.
2. **Evidence is preserved across switches:** capability levels, attempts, and
   misconceptions are tied to capabilities, not to a single goal, so they remain valid when
   the learner returns or changes ambition.
3. **One primary active learning journey** at a time (see `spec.md` §Goals and the
   documented migration note for the existing single-active-goal invariant).
4. **Persist:** ambition records + status; capability/attempt/misconception history is
   never deleted on switch.

## 15. Error handling, interrupted sessions, AI failures, incomplete assessments

- **Interrupted session / refresh:** all progress persists server-side; on return the
  learner resumes at the next unanswered question / next activity. No client-only state is
  treated as truth.
- **AI/provider failure (timeout, malformed, rate-limited, outage):** the request fails
  safe — the deterministic content and flow still work; AI-only extras are omitted with a
  neutral message; **learner records are never corrupted** and **saved progress remains
  accessible**. A circuit-breaker/backoff avoids hammering a failing provider.
- **Malformed AI output:** fails schema validation → discarded → deterministic fallback;
  never partially applied.
- **Incomplete diagnostic:** resume from the next item; if abandoned, offer an explicit
  "start at beginner (record as unknown)" rather than guessing a level.
- **Network error on submit:** the attempt is not recorded as passed; the learner can
  retry. Idempotent submission handling avoids double-counting.

## 16. Account deletion and learner-data export

1. **Export:** the learner can request a machine-readable export of their data (profile,
   ambitions/roadmap, capability levels, attempts, misconceptions, projects). Generated
   server-side, scoped to the authenticated learner, delivered as a download. No other
   learner's data is ever included.
2. **Deletion:** the learner can request deletion of their account data. Deleting the auth
   user already **cascades** to `learner_profiles` and `goals` (existing FK `ON DELETE
   CASCADE`); new learning tables must follow the same cascade pattern so deletion is
   complete. Confirmation step required; action is irreversible and stated as such.
3. Both actions require an authenticated session and re-confirmation; they are logged
   without leaking personal content.
4. **Persist/Delete:** export reads; deletion removes all learner-scoped rows.

---

*End of user flows. All journeys are proposed; the only implemented authenticated
experience today is profile + goals management on `/dashboard` (see `repository-audit.md`).*


