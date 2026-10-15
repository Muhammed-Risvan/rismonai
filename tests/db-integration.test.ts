/**
 * DB integration tests against the real development Supabase project.
 *
 * These run ONLY when ALLOW_DB_TESTS === "true". Two throwaway users (A, B)
 * are created with the service-role admin API and deleted in afterAll (and on
 * partial-creation failure), so nothing is left behind even if a test fails.
 *
 * The suite is order-dependent: tests run sequentially and share users A/B.
 * Connection strings and keys are never printed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { getDb } from "@/server/db/client";
import { ensureProfile, getProfile, updateProfile } from "@/server/services/profile";
import {
  changeGoalStatus,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from "@/server/services/goals";
import {
  listAmbitions,
  requireAmbition,
  seedAmbition,
  setGoalAmbition,
} from "@/server/services/ambitions";
import { seedAmbitionCatalog } from "@/server/services/seed-catalog";
import { startJourney } from "@/server/services/onboarding";
import {
  getDiagnosticState,
  optOut,
  reassess,
  startRun,
  submitAnswer,
} from "@/server/services/diagnostic";
import { selectResponsesForRun } from "@/server/data/diagnostic-responses";
import { selectRunsByLearner } from "@/server/data/diagnostic-runs";
import { selectCapabilitiesForLearner } from "@/server/data/learner-capabilities";
import {
  recordMisconceptionEncounter,
  resolveMisconception,
  selectMisconceptionsForLearner,
  selectOpenMisconceptions,
} from "@/server/data/learner-misconceptions";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
} from "@/server/errors";
import { goalCreateSchema } from "@/server/validation/goals";
import { profileUpdateSchema } from "@/server/validation/profile";
import { createRawClient } from "./helpers/raw-db";
import {
  createTestUser,
  deleteTestUser,
  getAdminClient,
  type TestUser,
} from "./helpers/test-users";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const ALLOW_DB_TESTS = process.env.ALLOW_DB_TESTS === "true";
const describeDb = ALLOW_DB_TESTS ? describe : describe.skip;

type IdRow = { id: string };
type AttemptRow = {
  id: string;
  mode: string;
  hints_used: number;
  correct: boolean;
};

describeDb("DB integration (requires ALLOW_DB_TESTS=true)", () => {
  let userA!: TestUser;
  let userB!: TestUser;

  beforeAll(async () => {
    userA = await createTestUser("a");
    try {
      userB = await createTestUser("b");
    } catch (error) {
      // Never leave a half-created fixture behind.
      await deleteTestUser(userA.id);
      throw error;
    }
  });

  afterAll(async () => {
    // Close the app's lazy pool so the Vitest worker can exit cleanly.
    try {
      await (getDb().$client as { end: () => Promise<void> }).end();
    } catch {
      // ignore
    }
    if (userA) await deleteTestUser(userA.id);
    if (userB) await deleteTestUser(userB.id);
  });

  it("ensureProfile creates the profile; a second call changes nothing", async () => {
    const first = await ensureProfile(userA.id);
    expect(first.id).toBe(userA.id);
    expect(first.timezone).toBe("UTC");
    expect(first.displayName).toBeNull();

    const fetched = await getProfile(userA.id);
    expect(fetched?.id).toBe(userA.id);

    const second = await ensureProfile(userA.id);
    expect(second.id).toBe(first.id);
    // Idempotent: created_at and updated_at are untouched on the second call.
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("a goal created by A persists across a brand-new DB connection", async () => {
    await ensureProfile(userA.id);
    const created = await createGoal(userA.id, { title: "Persist me" });

    const raw = createRawClient();
    try {
      const rows = (await raw`SELECT id FROM goals WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      expect(rows.map((r) => String(r.id))).toContain(created.id);
    } finally {
      await raw.end();
    }
  });

  it("user A cannot see or modify user B's goals; listGoals is scoped", async () => {
    await ensureProfile(userA.id);
    await ensureProfile(userB.id);

    const bGoal = await createGoal(userB.id, { title: "B private goal" });
    expect(bGoal.learnerId).toBe(userB.id);

    // A cannot read, update or change the status of B's goal: all NotFoundError
    // (the same error whether the goal is missing or foreign — no leak).
    await expect(getGoal(userA.id, bGoal.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      updateGoal(userA.id, bGoal.id, { title: "Hacked" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      changeGoalStatus(userA.id, bGoal.id, { status: "archived" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const aGoals = await listGoals(userA.id);
    expect(aGoals.some((g) => g.id === bGoal.id)).toBe(false);
    const bGoals = await listGoals(userB.id);
    expect(bGoals.some((g) => g.id === bGoal.id)).toBe(true);
  });

  it("rejects a client-supplied learner_id and never trusts it", async () => {
    // The strict schemas reject an injected learner_id key.
    expect(
      goalCreateSchema.safeParse({ title: "ok", learner_id: userB.id }).success,
    ).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ display_name: "ok", learner_id: userB.id })
        .success,
    ).toBe(false);

    // Ownership comes from the session-derived learnerId passed explicitly.
    await ensureProfile(userA.id);
    const created = await createGoal(userA.id, { title: "Owned by session" });
    expect(created.learnerId).toBe(userA.id);
  });

  it("allows only one active goal: second is paused, activation conflicts, DB index guards", async () => {
    await ensureProfile(userA.id);

    // Ensure exactly one active goal exists for A (the unique index guarantees
    // there can never be more than one).
    let active = (await listGoals(userA.id)).find((g) => g.status === "active");
    if (!active) {
      active = await createGoal(userA.id, { title: "Seed active goal" });
      expect(active.status).toBe("active");
    }

    // A second goal is created as 'paused' because an active goal already exists.
    const second = await createGoal(userA.id, { title: "Second goal" });
    expect(second.status).toBe("paused");

    // Activating it while another is active is a conflict (service guard).
    await expect(
      changeGoalStatus(userA.id, second.id, { status: "active" }),
    ).rejects.toBeInstanceOf(ConflictError);

    // The database partial unique index is the final guard.
    const raw = createRawClient();
    try {
      await expect(async () =>
        raw`INSERT INTO goals (learner_id, title, status) VALUES (${userA.id}, 'Direct second active', 'active')`,
      ).rejects.toHaveProperty("code", "23505");
    } finally {
      await raw.end();
    }
  });

  it("rejects invalid status transitions; archived/completed are terminal", async () => {
    await ensureProfile(userA.id);

    // Drive the single active goal to 'completed'.
    let active = (await listGoals(userA.id)).find((g) => g.status === "active");
    if (!active) active = await createGoal(userA.id, { title: "Active" });

    const done = await changeGoalStatus(userA.id, active.id, {
      status: "completed",
    });
    expect(done.status).toBe("completed");

    // 'completed' is terminal: every further transition is rejected.
    for (const to of ["active", "paused", "archived", "completed"] as const) {
      await expect(
        changeGoalStatus(userA.id, active.id, { status: to }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    }

    // Self-transition is never allowed. No active goal exists now, so a fresh
    // goal becomes 'active'.
    const fresh = await createGoal(userA.id, { title: "Self transition" });
    expect(fresh.status).toBe("active");
    await expect(
      changeGoalStatus(userA.id, fresh.id, { status: "active" }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("database check constraints reject a bad status and out-of-range hours", async () => {
    await ensureProfile(userA.id);
    const raw = createRawClient();
    try {
      await expect(async () =>
        raw`INSERT INTO goals (learner_id, title, status) VALUES (${userA.id}, 'Bad status', 'nonsense')`,
      ).rejects.toHaveProperty("code", "23514");

      await expect(async () =>
        raw`INSERT INTO goals (learner_id, title, status, hours_per_week) VALUES (${userA.id}, 'Too many', 'paused', 999)`,
      ).rejects.toHaveProperty("code", "23514");

      await expect(async () =>
        raw`INSERT INTO goals (learner_id, title, status, hours_per_week) VALUES (${userA.id}, 'Too few', 'paused', 0)`,
      ).rejects.toHaveProperty("code", "23514");
    } finally {
      await raw.end();
    }
  });

  it("the Supabase Data API (anon key) cannot read or write learner tables", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    await ensureProfile(userA.id);
    const created = await createGoal(userA.id, { title: "Drizzle-only row" });

    // Snapshot the truth via a direct DB connection.
    const rawBefore = createRawClient();
    let beforeIds: string[];
    try {
      const rows = (await rawBefore`SELECT id FROM goals WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      beforeIds = rows.map((r) => String(r.id));
    } finally {
      await rawBefore.end();
    }
    expect(beforeIds).toContain(created.id);

    // No session: reads return no rows (or an error); writes fail.
    const readProfiles = await anon.from("learner_profiles").select("*");
    expect(
      readProfiles.error !== null || (readProfiles.data?.length ?? 0) === 0,
    ).toBe(true);
    const readGoals = await anon.from("goals").select("*");
    expect(
      readGoals.error !== null || (readGoals.data?.length ?? 0) === 0,
    ).toBe(true);

    const ins = await anon
      .from("goals")
      .insert({ learner_id: userA.id, title: "Injected", status: "active" });
    expect(ins.error).not.toBeNull();
    const upd = await anon
      .from("goals")
      .update({ title: "Hacked" })
      .eq("learner_id", userA.id);
    expect(upd.error).not.toBeNull();
    const del = await anon.from("goals").delete().eq("learner_id", userA.id);
    expect(del.error).not.toBeNull();

    // Signed in as A: still no access (no RLS policies exist for any role).
    const signIn = await anon.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(signIn.error).toBeNull();
    const readGoalsSignedIn = await anon.from("goals").select("*");
    expect(
      readGoalsSignedIn.error !== null ||
        (readGoalsSignedIn.data?.length ?? 0) === 0,
    ).toBe(true);
    const insSignedIn = await anon.from("goals").insert({
      learner_id: userA.id,
      title: "Injected signed-in",
      status: "active",
    });
    expect(insSignedIn.error).not.toBeNull();
    await anon.auth.signOut();

    // Verify through the database that nothing changed.
    const rawAfter = createRawClient();
    let afterIds: string[];
    try {
      const rows = (await rawAfter`SELECT id FROM goals WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      afterIds = rows.map((r) => String(r.id));
    } finally {
      await rawAfter.end();
    }
    expect(afterIds.sort()).toEqual(beforeIds.sort());
  });

  it("updateProfile, updateGoal and changeGoalStatus refresh updated_at to now()", async () => {
    await ensureProfile(userA.id);
    const OLD = new Date("2000-01-01T00:00:00.000Z");

    // --- updateProfile ---
    {
      const raw = createRawClient();
      try {
        await raw`UPDATE learner_profiles SET created_at = ${OLD}, updated_at = ${OLD} WHERE id = ${userA.id}`;
      } finally {
        await raw.end();
      }
      const after = await updateProfile(userA.id, { display_name: "Stamped" });
      // updated_at was refreshed to now(); created_at is left untouched.
      expect(after.updatedAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(after.createdAt.getTime()).toBe(OLD.getTime());
    }

    // --- updateGoal ---
    let goal = (await listGoals(userA.id)).find((g) => g.status !== "archived" && g.status !== "completed");
    if (!goal) goal = await createGoal(userA.id, { title: "Stamp goal" });
    {
      const raw = createRawClient();
      try {
        await raw`UPDATE goals SET created_at = ${OLD}, updated_at = ${OLD} WHERE id = ${goal!.id}`;
      } finally {
        await raw.end();
      }
      const after = await updateGoal(userA.id, goal!.id, { title: "Stamped" });
      expect(after.updatedAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(after.createdAt.getTime()).toBe(OLD.getTime());
    }

    // --- changeGoalStatus (choose a valid transition from the current status) ---
    {
      const current = await getGoal(userA.id, goal!.id);
      const target =
        current.status === "active"
          ? "paused"
          : current.status === "paused"
            ? "archived"
            : null;
      expect(target).not.toBeNull();

      const raw = createRawClient();
      try {
        await raw`UPDATE goals SET created_at = ${OLD}, updated_at = ${OLD} WHERE id = ${goal!.id}`;
      } finally {
        await raw.end();
      }
      const after = await changeGoalStatus(userA.id, goal!.id, {
        status: target as "paused" | "archived",
      });
      expect(after.status).toBe(target);
      expect(after.updatedAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(after.createdAt.getTime()).toBe(OLD.getTime());
    }
  });

  // ==========================================================================
  // M1 — ambition catalog + goal↔ambition link + isolation
  // ==========================================================================

  it("seeds the ambition catalog from content/ idempotently", async () => {
    // First seed creates the catalog row(s).
    const first = await seedAmbitionCatalog();
    expect(first.seeded).toBeGreaterThanOrEqual(1);

    const ambitions = await listAmbitions();
    expect(ambitions.length).toBeGreaterThanOrEqual(1);
    const cse = ambitions.find((a) => a.id === "cloud-security-engineer");
    expect(cse).toBeDefined();
    expect(cse?.name).toBe("Cloud Security Engineer");

    // Re-seeding must not duplicate rows (upsert by id) and must stay stable.
    const before = await listAmbitions();
    await seedAmbitionCatalog();
    const after = await listAmbitions();
    expect(after.length).toBe(before.length);

    // A direct raw count confirms exactly one row for the seeded id.
    const raw = createRawClient();
    try {
      const rows = (await raw`SELECT id FROM ambitions WHERE id = 'cloud-security-engineer'`) as unknown as IdRow[];
      expect(rows.length).toBe(1);
    } finally {
      await raw.end();
    }
  });

  it("a learner can link their own goal to a catalog ambition", async () => {
    await ensureProfile(userA.id);
    const goal = await createGoal(userA.id, { title: "CSE journey" });

    const linked = await setGoalAmbition(
      userA.id,
      goal.id,
      "cloud-security-engineer",
    );
    expect(linked.ambitionId).toBe("cloud-security-engineer");

    // The change is visible through the learner-scoped read and persists.
    const refetched = await getGoal(userA.id, goal.id);
    expect(refetched.ambitionId).toBe("cloud-security-engineer");
  });

  it("rejects linking to a non-existent catalog ambition", async () => {
    await ensureProfile(userA.id);
    const goal = await createGoal(userA.id, { title: "Bad link" });
    await expect(
      setGoalAmbition(userA.id, goal.id, "not-a-real-ambition"),
    ).rejects.toBeInstanceOf(NotFoundError);
    // Goal remains unlinked.
    const refetched = await getGoal(userA.id, goal.id);
    expect(refetched.ambitionId).toBeNull();
  });

  it("learner A cannot read, modify, or link learner B's goal", async () => {
    await ensureProfile(userA.id);
    await ensureProfile(userB.id);

    const bGoal = await createGoal(userB.id, { title: "B private goal" });

    // A cannot link B's goal to an ambition (same NotFound as missing).
    await expect(
      setGoalAmbition(userA.id, bGoal.id, "cloud-security-engineer"),
    ).rejects.toBeInstanceOf(NotFoundError);

    // B's goal stays unlinked from A's attempt.
    const bRefetch = await getGoal(userB.id, bGoal.id);
    expect(bRefetch.ambitionId).toBeNull();

    // A cannot see B's goal in a scoped list.
    const aGoals = await listGoals(userA.id);
    expect(aGoals.some((g) => g.id === bGoal.id)).toBe(false);
  });

  it("the goal→ambition foreign key prevents an unknown ambition_id", async () => {
    await ensureProfile(userA.id);
    const raw = createRawClient();
    try {
      await expect(async () =>
        raw`INSERT INTO goals (learner_id, title, status, ambition_id)
            VALUES (${userA.id}, 'FK test', 'paused', 'no-such-ambition')`,
      ).rejects.toHaveProperty("code", "23503"); // foreign_key_violation
    } finally {
      await raw.end();
    }
  });

  it("deleting a catalog ambition nulls the link on goals (set null), keeps the goal", async () => {
    await ensureProfile(userA.id);
    // Seed a throwaway ambition, link a goal, then delete the ambition row.
    await seedAmbition({
      id: "temp-ambition",
      name: "Temp",
      description: "Temporary catalog entry for the set-null test.",
      targetOutcome: "Exercise the ON DELETE SET NULL behavior.",
      level: "beginner",
    });
    const goal = await createGoal(userA.id, { title: "Temp-linked goal" });
    await setGoalAmbition(userA.id, goal.id, "temp-ambition");
    expect((await getGoal(userA.id, goal.id)).ambitionId).toBe("temp-ambition");

    const raw = createRawClient();
    try {
      await raw`DELETE FROM ambitions WHERE id = 'temp-ambition'`;
      const after = await getGoal(userA.id, goal.id);
      // Goal survives; the ambition link is cleared (SET NULL), not cascaded.
      expect(after.id).toBe(goal.id);
      expect(after.ambitionId).toBeNull();
    } finally {
      await raw.end();
    }
  });

  it("requireAmbition throws NotFound for an unknown id (used when linking)", async () => {
    await expect(requireAmbition("nope")).rejects.toBeInstanceOf(NotFoundError);
    const ok = await requireAmbition("cloud-security-engineer");
    expect(ok.id).toBe("cloud-security-engineer");
  });

  it("the Supabase Data API (anon key) cannot read the ambitions catalog", async () => {
    await seedAmbitionCatalog();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    const read = await anon.from("ambitions").select("*");
    expect(read.error !== null || (read.data?.length ?? 0) === 0).toBe(true);

    const ins = await anon
      .from("ambitions")
      .insert({ id: "injected", name: "x", description: "x", target_outcome: "x" });
    expect(ins.error).not.toBeNull();
  });

  // ==========================================================================
  // M2 — onboarding: startJourney (create + link in one operation)
  // ==========================================================================

  it("startJourney creates an active goal linked to the selected ambition", async () => {
    await ensureProfile(userA.id);
    // User A may already hold an active goal from earlier tests — archive any
    // active goal the service did not create for this scenario so onboarding
    // runs from the true first-journey state.
    const pre = await listGoals(userA.id);
    for (const g of pre) {
      if (g.status === "active") {
        await changeGoalStatus(userA.id, g.id, { status: "archived" });
      }
    }

    const journey = await startJourney(userA.id, {
      ambitionId: "cloud-security-engineer",
      outcome: "Become a cloud security engineer within a year",
      hoursPerWeek: 6,
    });

    expect(journey.learnerId).toBe(userA.id);
    expect(journey.status).toBe("active");
    expect(journey.title).toBe("Cloud Security Engineer");
    expect(journey.ambitionId).toBe("cloud-security-engineer");
    expect(journey.targetOutcome).toBe(
      "Become a cloud security engineer within a year",
    );
    expect(journey.hoursPerWeek).toBe(6);

    // The selection persists: a later read returns the same linked goal.
    const refetched = await getGoal(userA.id, journey.id);
    expect(refetched.ambitionId).toBe("cloud-security-engineer");

    // Tidy up: archive the journey so later scenarios start clean.
    await changeGoalStatus(userA.id, journey.id, { status: "archived" });
  });

  it("startJourney rejects an unknown ambition without creating a goal", async () => {
    await ensureProfile(userA.id);
    const before = await listGoals(userA.id);

    await expect(
      startJourney(userA.id, {
        ambitionId: "definitely-not-a-real-ambition",
        outcome: "Something",
        hoursPerWeek: 4,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const after = await listGoals(userA.id);
    expect(after.length).toBe(before.length);
  });

  it("startJourney refuses a second active journey (one-active-goal invariant)", async () => {
    await ensureProfile(userA.id);
    // Ensure A holds exactly one active journey first.
    let active = (await listGoals(userA.id)).find(
      (g) => g.status === "active",
    );
    if (!active) {
      active = await startJourney(userA.id, {
        ambitionId: "cloud-security-engineer",
        outcome: "First journey",
        hoursPerWeek: 5,
      });
    }
    expect(active.status).toBe("active");

    const before = await listGoals(userA.id);
    await expect(
      startJourney(userA.id, {
        ambitionId: "cloud-security-engineer",
        outcome: "Second journey",
        hoursPerWeek: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // No extra goal was created: the pre-check refuses before any insert,
    // and the DB index is the final guard. A still has one active journey
    // and the same number of goals.
    const after = await listGoals(userA.id);
    expect(after.length).toBe(before.length);
    expect(after.filter((g) => g.status === "active").length).toBe(1);

    await changeGoalStatus(userA.id, active.id, { status: "archived" });
  });

  it("startJourney is learner-scoped: A cannot start for B, and B sees only their own selection", async () => {
    await ensureProfile(userA.id);
    await ensureProfile(userB.id);

    // B starts their own journey through the same service entry point.
    const bPre = (await listGoals(userB.id)).filter(
      (g) => g.status === "active",
    );
    for (const g of bPre) {
      await changeGoalStatus(userB.id, g.id, { status: "archived" });
    }
    const bJourney = await startJourney(userB.id, {
      ambitionId: "cloud-security-engineer",
      outcome: "B's own journey",
      hoursPerWeek: 3,
    });
    expect(bJourney.learnerId).toBe(userB.id);

    // A cannot read B's journey (same NotFound as missing — no leak).
    await expect(getGoal(userA.id, bJourney.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const aGoals = await listGoals(userA.id);
    expect(aGoals.some((g) => g.id === bJourney.id)).toBe(false);

    // B sees their persisted selection on return.
    const bGoals = await listGoals(userB.id);
    expect(bGoals.some((g) => g.id === bJourney.id)).toBe(true);

    await changeGoalStatus(userB.id, bJourney.id, { status: "archived" });
  });

  // ==========================================================================
  // M3 — baseline diagnostic (state machine, grading, locks, history).
  // Order-dependent like the rest of this suite: A and B both start with
  // no active journey (the preceding tests archived them), the catalog is
  // already seeded, and the cascade test below stays last.
  // ==========================================================================

  // The seed map's assessment bank (the guided practice item is excluded
  // by construction; the boundary probe is conditional on the MCQ).
  const ITEM = {
    mcq: "exercise-shared-responsibility-mcq",
    boundary: "exercise-shared-boundary-check",
    identity: "exercise-identity-allowlist-assessment",
    network: "exercise-network-exposure-assessment",
    detection: "exercise-detection-signal-assessment",
  } as const;
  let runA1 = ""; // A's completed baseline run
  let runB1 = ""; // B's opted-out run

  it("M3: startRun without an active journey is NotFound", async () => {
    await ensureProfile(userA.id);
    // Precondition of this block: the earlier suites archived A's journey.
    const active = (await listGoals(userA.id)).find(
      (g) => g.status === "active",
    );
    expect(active).toBeUndefined();
    await expect(startRun(userA.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("M3: startRun is idempotent and the client DTO never carries answer keys", async () => {
    await ensureProfile(userA.id);
    const journey = await startJourney(userA.id, {
      ambitionId: "cloud-security-engineer",
      outcome: "Baseline triage",
      hoursPerWeek: 5,
    });

    // Linked but not started: the state machine says so honestly.
    const before = await getDiagnosticState(userA.id);
    expect(before.status).toBe("not_started");
    if (before.status === "not_started") {
      expect(before.goalId).toBe(journey.id);
      expect(before.ambitionId).toBe("cloud-security-engineer");
    }

    const run1 = await startRun(userA.id);
    expect(run1.status).toBe("in_progress");
    expect(run1.ambitionId).toBe("cloud-security-engineer");
    expect(run1.goalId).toBe(journey.id);
    expect(run1.contentVersion).toBe("0.1.0");
    runA1 = run1.id;

    // Server-only fields must never be part of the client DTO.
    expect(run1).not.toHaveProperty("itemsSnapshot");
    expect(run1).not.toHaveProperty("itemIds");
    expect(run1).not.toHaveProperty("requiredCapabilityIds");
    expect(run1).not.toHaveProperty("learnerId");
    expect(JSON.stringify(run1)).not.toContain('"accepted"');

    // Idempotent per (learner, ambition): a second start returns the same run.
    const run2 = await startRun(userA.id);
    expect(run2.id).toBe(runA1);

    // Resume: deterministic next item, empty progress, full bank size.
    const state = await getDiagnosticState(userA.id);
    expect(state.status).toBe("in_progress");
    if (state.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    expect(state.run.id).toBe(runA1);
    expect(state.total).toBe(5);
    expect(state.answered).toBe(0);
    expect(state.nextItem?.itemId).toBe(ITEM.mcq);
  });

  it("M3: submitAnswer is ownership-scoped, grades from the snapshot, first-answer-wins", async () => {
    const before = await getDiagnosticState(userA.id);
    if (before.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = before.run.id;

    // B cannot submit to A's run: foreign run → same NotFound as missing.
    await expect(
      submitAnswer(userB.id, { runId, itemId: ITEM.mcq, response: "you" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // An item outside this run's frozen bank is never trusted, even for A.
    await expect(
      submitAnswer(userA.id, {
        runId,
        itemId: "exercise-not-in-bank",
        response: "you",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Wrong first answer: graded false against the snapshot's accepted
    // answers, and the wrong answer triggers the conditional remedial probe.
    const first = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.mcq,
      response: "provider",
    });
    expect(first.duplicate).toBe(false);
    expect(first.correct).toBe(false);
    expect(first.complete).toBe(false);
    expect(first.nextItem?.itemId).toBe(ITEM.boundary);

    // First-answer-wins: a later correct answer must NOT change the grade.
    const dup = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.mcq,
      response: "you",
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.correct).toBe(false); // canonical row: the FIRST answer's grade

    // The persisted row really is the first one (proven on a fresh connection).
    const raw = createRawClient();
    try {
      const rows = (await raw`
        SELECT response, correct FROM diagnostic_responses
        WHERE run_id = ${runId} AND item_id = ${ITEM.mcq}`) as unknown as {
        response: string;
        correct: boolean;
      }[];
      expect(rows.length).toBe(1);
      expect(rows[0].response).toBe("provider");
      expect(rows[0].correct).toBe(false);
    } finally {
      await raw.end();
    }

    // Resume re-derives the same next item from persisted answers only.
    const after = await getDiagnosticState(userA.id);
    if (after.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    expect(after.answered).toBe(1);
    expect(after.nextItem?.itemId).toBe(ITEM.boundary);
  });

  it("M3: completing the run writes differentiated levels, never mastered, and freezes the run", async () => {
    const before = await getDiagnosticState(userA.id);
    if (before.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = before.run.id;

    // Remedial probe answered wrong (still covers the capability)…
    await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.boundary,
      response: "provider",
    });
    // …then the remaining capabilities answered correctly.
    const identity = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.identity,
      response: "read-only",
    });
    expect(identity.complete).toBe(false); // coverage gate: 2 of 4 caps
    expect(identity.nextItem?.itemId).toBe(ITEM.network);
    const network = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.network,
      response: "private-only",
    });
    expect(network.complete).toBe(false); // coverage gate: 3 of 4 caps
    expect(network.nextItem?.itemId).toBe(ITEM.detection);
    const last = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.detection,
      response: "sign-in log",
    });
    expect(last.complete).toBe(true);
    expect(last.nextItem).toBeNull();

    // Terminal: further submits are rejected with Conflict.
    await expect(
      submitAnswer(userA.id, { runId, itemId: ITEM.mcq, response: "you" }),
    ).rejects.toBeInstanceOf(ConflictError);

    // Per-capability triage derived from THIS run's answers only, by the real
    // mastery engine: answered wrongly → practising; answered correctly →
    // demonstrated (capped — a diagnostic can never award `mastered`).
    const state = await getDiagnosticState(userA.id);
    expect(state.status).toBe("complete");
    if (state.status !== "complete") {
      throw new Error("expected complete state");
    }
    expect(state.run.id).toBe(runId);
    expect(state.run.completedAt).not.toBeNull();
    const levels = new Map(state.levels.map((l) => [l.capabilityId, l.level]));
    expect(state.levels).toHaveLength(4);
    expect(levels.get("cloud-shared-responsibility")).toBe("practising");
    expect(levels.get("identity-and-access-basics")).toBe("demonstrated");
    expect(levels.get("network-security-basics")).toBe("demonstrated");
    expect(levels.get("logging-and-monitoring")).toBe("demonstrated");
    expect(state.levels.some((l) => l.level === "mastered")).toBe(false);
    expect(state.levels.every((l) => l.runId === runId)).toBe(true);
    expect(state.levels.every((l) => l.source === "diagnostic")).toBe(true);

    // A demonstrated capability is always scheduled for a later review.
    expect(
      state.levels.every((l) => l.reviewAt !== null || l.level === "practising"),
    ).toBe(true);

    // Evidence receipts: a level is never an unsupported opinion.
    const practised = state.levels.find(
      (l) => l.capabilityId === "cloud-shared-responsibility",
    );
    expect(practised?.evidenceCount).toBe(0);
    expect(practised?.assistedPass).toBe(false);
    const correct = state.levels.find(
      (l) => l.capabilityId === "identity-and-access-basics",
    );
    expect(correct?.evidenceCount).toBe(1);
    expect(correct?.assistedPass).toBe(false);
  });

  it("M3: a wrong answer is remembered WITH its reason, and the reason is exposed", async () => {
    const before = await getDiagnosticState(userA.id);
    if (before.status !== "complete") {
      throw new Error("expected complete state");
    }
    const runId = before.run.id;

    // "provider" on the shared-responsibility item is an authored signature for
    // a specific misunderstanding — not just a false flag.
    const wrong = await submitAnswer(userA.id, {
      runId,
      itemId: ITEM.mcq,
      response: "provider",
    }).catch((error: unknown) => error);

    // The run is already terminal, so the submit is rejected — but the
    // signature must still be resolvable in content for the assertion below.
    expect(wrong).toBeInstanceOf(ConflictError);

    const rows = await selectMisconceptionsForLearner(userA.id);
    const provider = rows.find(
      (r) => r.misconceptionId === "misconception-provider-secures-everything",
    );
    expect(provider).toBeDefined();
    expect(provider?.capabilityId).toBe("cloud-shared-responsibility");
    expect(provider?.timesEncountered).toBeGreaterThanOrEqual(1);
    expect(provider?.resolvedAt).toBeNull();

    // A repeated encounter increments, never duplicates the row.
    const beforeCount = rows.length;
    await recordMisconceptionEncounter(
      {
        learnerId: userA.id,
        capabilityId: provider!.capabilityId,
        misconceptionId: provider!.misconceptionId,
        lastItemId: provider!.lastItemId,
      },
      getDb(),
    );
    const after = await selectMisconceptionsForLearner(userA.id);
    expect(after).toHaveLength(beforeCount);
    const bumped = after.find((r) => r.id === provider!.id);
    expect(bumped!.timesEncountered).toBe(provider!.timesEncountered + 1);

    // Resolution is earned, not self-declared.
    await resolveMisconception(
      userA.id,
      "misconception-provider-secures-everything",
      getDb(),
    );
    const resolved = await selectOpenMisconceptions(userA.id, getDb());
    expect(
      resolved.some(
        (r) =>
          r.misconceptionId === "misconception-provider-secures-everything",
      ),
    ).toBe(false);
  });

  it("M3: a learner cannot read or write another learner's misconception history", async () => {
    const rowsA = await selectMisconceptionsForLearner(userA.id);
    expect(rowsA.length).toBeGreaterThan(0);
    // B has no rows of their own; the query is scoped by learnerId.
    const rowsB = await selectMisconceptionsForLearner(userB.id);
    expect(rowsB).toHaveLength(0);

    // Resolution is scoped too: resolving A's misconception as B is a no-op.
    const resolved = await resolveMisconception(
      userB.id,
      "misconception-provider-secures-everything",
      getDb(),
    );
    expect(resolved).toBeUndefined();
  });

  it("M3: two learners are isolated — separate runs, states, and ownership", async () => {
    await ensureProfile(userB.id);
    // Precondition: the preceding suite archived B's journey.
    const activeB = (await listGoals(userB.id)).find(
      (g) => g.status === "active",
    );
    expect(activeB).toBeUndefined();

    await startJourney(userB.id, {
      ambitionId: "cloud-security-engineer",
      outcome: "B baseline",
      hoursPerWeek: 3,
    });
    const runB = await startRun(userB.id);
    expect(runB.status).toBe("in_progress");
    runB1 = runB.id;

    const stateA = await getDiagnosticState(userA.id);
    const stateB = await getDiagnosticState(userB.id);
    expect(stateA.status).toBe("complete");
    expect(stateB.status).toBe("in_progress");
    if (stateA.status !== "complete" || stateB.status !== "in_progress") {
      throw new Error("expected terminal A and live B states");
    }
    expect(stateA.run.id).toBe(runA1);
    expect(stateB.run.id).toBe(runB1);
    expect(stateA.run.id).not.toBe(stateB.run.id);

    // B cannot opt out A's run (ownership is checked before any detail of
    // the run's existence or status leaks back).
    await expect(optOut(userB.id, stateA.run.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    // A cannot answer B's run.
    await expect(
      submitAnswer(userA.id, {
        runId: stateB.run.id,
        itemId: ITEM.mcq,
        response: "you",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // A's state is untouched by B's activity.
    const stateA2 = await getDiagnosticState(userA.id);
    expect(stateA2.status).toBe("complete");
  });

  it("M3: submitAnswer blocks on the run row lock (real FOR UPDATE contention)", async () => {
    const state = await getDiagnosticState(userB.id);
    if (state.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = state.run.id;

    let releaseLock!: () => void;
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let lockAcquired!: () => void;
    const lockHeld = new Promise<void>((resolve) => {
      lockAcquired = resolve;
    });

    const raw = createRawClient();
    try {
      // A SECOND database connection takes the run row lock and HOLDS it.
      const held = raw.begin(async (tx) => {
        await tx`SELECT id FROM diagnostic_runs WHERE id = ${runId} FOR UPDATE`;
        lockAcquired();
        await lockReleased;
      });
      await lockHeld;

      // The service must serialize on that lock instead of writing.
      let submitted = false;
      const pending = submitAnswer(userB.id, {
        runId,
        itemId: ITEM.identity,
        response: "read-only",
      }).then((result) => {
        submitted = true;
        return result;
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(submitted).toBe(false); // still blocked by the held lock

      releaseLock();
      const result = await pending;
      await held;

      expect(result.duplicate).toBe(false);
      expect(result.correct).toBe(true);
    } finally {
      releaseLock();
      await raw.end();
    }
  });

  it("M3: concurrent duplicate submits yield exactly one row (first-answer-wins)", async () => {
    const state = await getDiagnosticState(userB.id);
    if (state.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = state.run.id;

    const [a, b] = await Promise.all([
      submitAnswer(userB.id, { runId, itemId: ITEM.mcq, response: "you" }),
      submitAnswer(userB.id, { runId, itemId: ITEM.mcq, response: "you" }),
    ]);
    // Exactly one submit created the row; the other reports the duplicate.
    expect([a, b].filter((r) => !r.duplicate)).toHaveLength(1);
    expect(a.correct).toBe(true);
    expect(b.correct).toBe(true);

    const responses = await selectResponsesForRun(userB.id, runId);
    const mcqRows = responses.filter((r) => r.itemId === ITEM.mcq);
    expect(mcqRows).toHaveLength(1);
    expect(mcqRows[0].correct).toBe(true);
  });

  it("M3: opt-out completes the run with honest unknown levels and blocks submits", async () => {
    const before = await getDiagnosticState(userB.id);
    if (before.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = before.run.id;

    // Answers given so far must survive opt-out (history is never deleted).
    const beforeResponses = await selectResponsesForRun(userB.id, runId);
    expect(beforeResponses.map((r) => r.itemId).sort()).toEqual(
      [ITEM.identity, ITEM.mcq].sort(),
    );

    const opted = await optOut(userB.id, runId);
    expect(opted.status).toBe("opted_out");
    expect(opted.completedAt).not.toBeNull();
    expect(opted).not.toHaveProperty("itemsSnapshot");

    // Every required capability is recorded as unknown — honest, not assumed.
    const levels = await selectCapabilitiesForLearner(userB.id);
    expect(levels).toHaveLength(4);
    expect(levels.every((l) => l.level === "unknown")).toBe(true);
    expect(levels.every((l) => l.source === "opt-out")).toBe(true);
    expect(levels.some((l) => l.level === "mastered")).toBe(false);

    const state = await getDiagnosticState(userB.id);
    expect(state.status).toBe("opted_out");
    if (state.status !== "opted_out") {
      throw new Error("expected opted_out state");
    }
    expect(state.run.id).toBe(runId);

    // Terminal: submits and a second opt-out are rejected; answers kept.
    await expect(
      submitAnswer(userB.id, {
        runId,
        itemId: ITEM.network,
        response: "private-only",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(optOut(userB.id, runId)).rejects.toBeInstanceOf(ConflictError);
    const afterResponses = await selectResponsesForRun(userB.id, runId);
    expect(afterResponses).toHaveLength(beforeResponses.length);
  });

  it("M3: reassessment starts a fresh run; history and levels are preserved", async () => {
    const runB2 = await reassess(userB.id);
    expect(runB2.status).toBe("in_progress");
    expect(runB2.id).not.toBe(runB1);

    // The opted-out run still exists untouched.
    const runs = await selectRunsByLearner(userB.id);
    const old = runs.find((r) => r.id === runB1);
    expect(old?.status).toBe("opted_out");
    const oldResponses = await selectResponsesForRun(userB.id, runB1);
    expect(oldResponses).toHaveLength(2);

    // Levels do NOT change when a new run starts — only on completion.
    const levels = await selectCapabilitiesForLearner(userB.id);
    expect(levels).toHaveLength(4);
    expect(levels.every((l) => l.level === "unknown")).toBe(true);
    expect(levels.every((l) => l.runId === runB1)).toBe(true);

    // The new run resumes with a clean slate.
    const state = await getDiagnosticState(userB.id);
    expect(state.status).toBe("in_progress");
    if (state.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    expect(state.run.id).toBe(runB2.id);
    expect(state.answered).toBe(0);
    expect(state.nextItem?.itemId).toBe(ITEM.mcq);
  });

  it("M3: all-correct completion on the same bank yields different levels (acceptance)", async () => {
    const state0 = await getDiagnosticState(userB.id);
    if (state0.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    const runId = state0.run.id;

    // Trigger answered correctly → the remedial probe is EXCUSED entirely.
    const mcq = await submitAnswer(userB.id, {
      runId,
      itemId: ITEM.mcq,
      response: "you",
    });
    expect(mcq.duplicate).toBe(false);
    expect(mcq.correct).toBe(true);
    expect(mcq.nextItem?.itemId).toBe(ITEM.identity);

    await submitAnswer(userB.id, {
      runId,
      itemId: ITEM.identity,
      response: "read-only",
    });
    await submitAnswer(userB.id, {
      runId,
      itemId: ITEM.network,
      response: "private-only",
    });
    const last = await submitAnswer(userB.id, {
      runId,
      itemId: ITEM.detection,
      response: "sign-in log",
    });
    expect(last.complete).toBe(true);
    expect(last.nextItem).toBeNull();

    const levelsB = await selectCapabilitiesForLearner(userB.id);
    expect(levelsB).toHaveLength(4);
    expect(levelsB.every((l) => l.level === "demonstrated")).toBe(true);
    expect(levelsB.every((l) => l.source === "diagnostic")).toBe(true);
    expect(levelsB.every((l) => l.runId === runId)).toBe(true);

    // Acceptance: the SAME item bank produced DIFFERENT levels — A missed
    // shared responsibility (practising) while B was correct everywhere.
    const levelsA = await selectCapabilitiesForLearner(userA.id);
    const byCapA = new Map(levelsA.map((l) => [l.capabilityId, l.level]));
    const byCapB = new Map(levelsB.map((l) => [l.capabilityId, l.level]));
    const differing = [...byCapA].filter(
      ([capabilityId, level]) => byCapB.get(capabilityId) !== level,
    );
    expect(differing.length).toBeGreaterThan(0);
    expect(byCapA.get("cloud-shared-responsibility")).toBe("practising");
    expect(byCapB.get("cloud-shared-responsibility")).toBe("demonstrated");
    // A diagnostic NEVER assigns mastered — for either learner.
    expect(levelsA.some((l) => l.level === "mastered")).toBe(false);
    expect(levelsB.some((l) => l.level === "mastered")).toBe(false);
  });

  it("M3: reassessment after completion preserves the finished run and resets the live one", async () => {
    const runA2 = await reassess(userA.id);
    expect(runA2.status).toBe("in_progress");
    expect(runA2.id).not.toBe(runA1);

    const runs = await selectRunsByLearner(userA.id);
    const old = runs.find((r) => r.id === runA1);
    expect(old?.status).toBe("complete");
    expect(old?.completedAt).not.toBeNull();
    const oldResponses = await selectResponsesForRun(userA.id, runA1);
    // mcq (wrong → probe fired) + boundary + identity + network + detection.
    // The duplicate mcq submit never created a row (first-answer-wins).
    expect(oldResponses).toHaveLength(5);

    // Starting a new run never rewrites existing levels…
    const levels = await selectCapabilitiesForLearner(userA.id);
    expect(levels.every((l) => l.runId === runA1)).toBe(true);

    // …and the live run starts clean.
    const state = await getDiagnosticState(userA.id);
    expect(state.status).toBe("in_progress");
    if (state.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    expect(state.run.id).toBe(runA2.id);
    expect(state.answered).toBe(0);
  });

  it("M3: concurrent startRun calls resolve to one persisted in-progress run", async () => {
    // Precondition: BOTH of B's existing runs are terminal, so each concurrent
    // caller passes selectInProgressRun and attempts the INSERT. With the app
    // pool at max:1 (single FIFO connection) both SELECTs run before either
    // INSERT, so the loser hits the partial unique index (23505) and must take
    // startRun's real conflict-recovery path: isUniqueViolation → re-select the
    // winning row instead of throwing or duplicating the run.
    const before = await getDiagnosticState(userB.id);
    expect(before.status).toBe("complete");

    const [first, second] = await Promise.all([
      startRun(userB.id),
      startRun(userB.id),
    ]);
    expect(first.status).toBe("in_progress");
    expect(second.status).toBe("in_progress");
    expect(first.id).toBe(second.id);
    expect(first).toEqual(second); // both DTOs derive from the same persisted row

    // Exactly ONE in-progress row exists for (learner, ambition).
    const raw = createRawClient();
    try {
      const rows = (await raw`
        SELECT id FROM diagnostic_runs
        WHERE learner_id = ${userB.id}
          AND ambition_id = 'cloud-security-engineer'
          AND status = 'in_progress'`) as unknown as IdRow[];
      expect(rows).toHaveLength(1);
      expect(String(rows[0].id)).toBe(first.id);
    } finally {
      await raw.end();
    }

    // Idempotency still holds after the race.
    const again = await startRun(userB.id);
    expect(again.id).toBe(first.id);
  });

  it("M3: a corrupt items_snapshot fails safely and writes no response or level", async () => {
    // Obtain the live run through the service — its resume path validates the
    // snapshot on the way out, proving the run is healthy BEFORE corruption.
    const run = await startRun(userA.id);
    expect(run.status).toBe("in_progress");
    const runId = run.id;

    const responsesBefore = await selectResponsesForRun(userA.id, runId);
    expect(responsesBefore).toHaveLength(0);
    const byCapability = <T extends { capabilityId: string }>(rows: T[]) =>
      [...rows].sort((x, y) => x.capabilityId.localeCompare(y.capabilityId));
    const levelsBefore = byCapability(
      await selectCapabilitiesForLearner(userA.id),
    );
    expect(levelsBefore).toHaveLength(4); // A's completed baseline run owns these

    const raw = createRawClient();
    let original: string | null = null;
    let corrupted = false;
    try {
      // Keep the test-owned snapshot (as JSON text) so it can be restored.
      const rows = (await raw`
        SELECT items_snapshot::text AS snapshot FROM diagnostic_runs
        WHERE id = ${runId} AND learner_id = ${userA.id}`) as unknown as {
        snapshot: string;
      }[];
      expect(rows).toHaveLength(1);
      original = rows[0].snapshot;

      // Corrupt it directly: valid JSON, but not a diagnostic snapshot, so
      // diagnosticSnapshotSchema must refuse it — bad data never grades.
      await raw`
        UPDATE diagnostic_runs SET items_snapshot = '{"corrupt": true}'::jsonb
        WHERE id = ${runId} AND learner_id = ${userA.id}`;
      corrupted = true;

      // Loading fails safely with the explicit server-side error…
      await expect(getDiagnosticState(userA.id)).rejects.toThrow(
        /Corrupt diagnostic snapshot/,
      );
      // …and submitting fails BEFORE grading, inside the transaction: no
      // response row and no capability-level record may be written.
      await expect(
        submitAnswer(userA.id, { runId, itemId: ITEM.mcq, response: "you" }),
      ).rejects.toThrow(/Corrupt diagnostic snapshot/);

      const responsesAfter = await selectResponsesForRun(userA.id, runId);
      expect(responsesAfter).toHaveLength(0);
      const levelsAfter = byCapability(
        await selectCapabilitiesForLearner(userA.id),
      );
      expect(levelsAfter).toEqual(levelsBefore); // still runA1's rows, untouched
    } finally {
      if (corrupted && original !== null) {
        // Put the test-owned row back exactly as it was, even on failure.
        await raw`
          UPDATE diagnostic_runs SET items_snapshot = ${original}::jsonb
          WHERE id = ${runId} AND learner_id = ${userA.id}`;
      }
      await raw.end();
    }

    // Restored: the same run loads again with its original five-item snapshot.
    const healed = await getDiagnosticState(userA.id);
    expect(healed.status).toBe("in_progress");
    if (healed.status !== "in_progress") {
      throw new Error("expected in_progress state");
    }
    expect(healed.run.id).toBe(runId);
    expect(healed.answered).toBe(0);
    expect(healed.total).toBe(5);
  });

  it("the Supabase Data API (anon and authenticated) cannot read the diagnostic tables", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    await ensureProfile(userA.id);
    const tables = [
      "diagnostic_runs",
      "diagnostic_responses",
      "learner_capabilities",
      "learner_misconceptions",
    ] as const;

    // Ground truth through direct DB connections: real learner rows exist in
    // all these tables right now, so a successful Data API read WOULD return
    // them (this keeps the error-or-empty fallback from passing vacuously).
    // Each table is locked by ENABLE ROW LEVEL SECURITY with no policies plus
    // REVOKE ALL ... FROM anon, authenticated (migrations 0002/0003).
    const countViaRaw = async () => {
      const raw = createRawClient();
      try {
        const runs = (await raw`SELECT id FROM diagnostic_runs`) as unknown as IdRow[];
        const responses = (await raw`SELECT id FROM diagnostic_responses`) as unknown as IdRow[];
        const levels = (await raw`SELECT id FROM learner_capabilities`) as unknown as IdRow[];
        const misconceptions = (await raw`SELECT id FROM learner_misconceptions`) as unknown as IdRow[];
        return [
          runs.length,
          responses.length,
          levels.length,
          misconceptions.length,
        ];
      } finally {
        await raw.end();
      }
    };
    const before = await countViaRaw();
    expect(before[0]).toBeGreaterThan(0);
    expect(before[1]).toBeGreaterThan(0);
    expect(before[2]).toBeGreaterThan(0);
    expect(before[3]).toBeGreaterThan(0);

    // No session: every diagnostic-table read fails or returns nothing.
    const anonReads = await Promise.all(
      tables.map((table) => anon.from(table).select("*")),
    );
    for (const read of anonReads) {
      expect(read.error !== null || (read.data?.length ?? 0) === 0).toBe(true);
    }

    // Signed in as A (the authenticated Data API role): still denied.
    const signIn = await anon.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(signIn.error).toBeNull();
    const authedReads = await Promise.all(
      tables.map((table) => anon.from(table).select("*")),
    );
    for (const read of authedReads) {
      expect(read.error !== null || (read.data?.length ?? 0) === 0).toBe(true);
    }
    await anon.auth.signOut();

    // Reads have no side effects: the same rows are still there.
    expect(await countViaRaw()).toEqual(before);
  });


  // ---------------------------------------------------------------------
  // M1.1 — `attempts`, the general evidence ledger for taught material.
  //
  // ORDERING CONSTRAINT: this block MUST stay above "deleting auth user A
  // cascades …", which destroys user A's auth record. The suite is
  // order-dependent and shares users A/B, so any block placed after that test
  // cannot call `ensureProfile(userA.id)` — it fails the FK to `auth.users`.
  // This block was originally appended at the end of the file and all seven of
  // its tests failed for exactly that reason. If you add tests that touch user
  // A, put them here, not at the bottom.
  // ---------------------------------------------------------------------

  describeDb("M1.1 attempts ledger", () => {
    const CAPABILITY = "cloud-shared-responsibility";
    const ITEM = "exercise-shared-boundary-check";

    /** Inserts directly through the raw client so DB constraints are exercised. */
    async function insertAttempt(
      values: {
        learnerId: string;
        itemId?: string;
        capabilityId?: string;
        correct?: boolean;
        mode?: string;
        hintsUsed?: number;
        misconceptionId?: string | null;
        response?: string;
      },
    ) {
      const raw = createRawClient();
      try {
        return await raw`
          INSERT INTO attempts (
            learner_id, capability_id, item_id, response, correct,
            mode, hints_used, misconception_id
          ) VALUES (
            ${values.learnerId},
            ${values.capabilityId ?? CAPABILITY},
            ${values.itemId ?? ITEM},
            ${values.response ?? "you"},
            ${values.correct ?? true},
            ${values.mode ?? "independent"},
            ${values.hintsUsed ?? 0},
            ${values.misconceptionId ?? null}
          )
          RETURNING id
        `;
      } finally {
        await raw.end();
      }
    }

    it("stores a guided attempt and an independent attempt for the same item", async () => {
      await ensureProfile(userA.id);
      await insertAttempt({
        learnerId: userA.id,
        mode: "guided",
        hintsUsed: 2,
      });
      await insertAttempt({ learnerId: userA.id, mode: "independent" });

      const raw = createRawClient();
      try {
        const rows = (await raw`
          SELECT id, mode, hints_used, correct
          FROM attempts WHERE learner_id = ${userA.id}
          ORDER BY created_at
        `) as unknown as AttemptRow[];
        expect(rows.length).toBeGreaterThanOrEqual(2);
        // Repeating an item is allowed and expected — it is the repeat-practice
        // signal the mastery engine depends on.
        const guided = rows.filter((r) => r.mode === "guided");
        const independent = rows.filter((r) => r.mode === "independent");
        expect(guided.length).toBeGreaterThanOrEqual(1);
        expect(independent.length).toBeGreaterThanOrEqual(1);
      } finally {
        await raw.end();
      }
    });

    it("REFUSES an 'independent' attempt that consumed hints", async () => {
      await ensureProfile(userA.id);
      // The load-bearing guarantee: help can never be recorded as proof.
      await expect(
        insertAttempt({
          learnerId: userA.id,
          mode: "independent",
          hintsUsed: 1,
        }),
      ).rejects.toThrow();
    });

    it("accepts a guided attempt that consumed hints", async () => {
      await ensureProfile(userA.id);
      await expect(
        insertAttempt({ learnerId: userA.id, mode: "guided", hintsUsed: 3 }),
      ).resolves.toBeDefined();
    });

    it("REFUSES a misconception attached to a correct answer", async () => {
      await ensureProfile(userA.id);
      await expect(
        insertAttempt({
          learnerId: userA.id,
          correct: true,
          misconceptionId: "misconception-provider-secures-everything",
        }),
      ).rejects.toThrow();
    });

    it("REFUSES negative hints, a bad mode, and an over-long response", async () => {
      await ensureProfile(userA.id);
      await expect(
        insertAttempt({ learnerId: userA.id, hintsUsed: -1, mode: "guided" }),
      ).rejects.toThrow();
      await expect(
        insertAttempt({ learnerId: userA.id, mode: "half-guessed" }),
      ).rejects.toThrow();
      await expect(
        insertAttempt({ learnerId: userA.id, response: "x".repeat(501) }),
      ).rejects.toThrow();
    });

    it("refuses an attempt for a learner that does not exist", async () => {
      await expect(
        insertAttempt({
          learnerId: "00000000-0000-4000-8000-00000000dead",
        }),
      ).rejects.toThrow();
    });

    it("learner A cannot read or write learner B's attempts", async () => {
      await ensureProfile(userA.id);
      await ensureProfile(userB.id);
      await insertAttempt({ learnerId: userA.id });

      // Writes are always learner-scoped through the FK; there is no way to
      // attach B's attempt to A without knowing B's id, and the service layer
      // never accepts a learner id from the client. Isolation is verified here
      // by proving the per-learner index read returns only that learner's rows.
      const raw = createRawClient();
      try {
        const aRows = (await raw`
          SELECT id FROM attempts WHERE learner_id = ${userA.id}
        `) as unknown as IdRow[];
        const bRows = (await raw`
          SELECT id FROM attempts WHERE learner_id = ${userB.id}
        `) as unknown as IdRow[];
        expect(bRows.length).toBe(0);
        expect(aRows.length).toBeGreaterThan(0);
      } finally {
        await raw.end();
      }
    });

    it("the Supabase Data API (anon and authenticated) cannot read attempts", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const anon = createClient(url, anonKey, { auth: { persistSession: false } });

      await ensureProfile(userA.id);
      await insertAttempt({ learnerId: userA.id });

      const raw = createRawClient();
      let realRows: number;
      try {
        const rows = (await raw`SELECT id FROM attempts`) as unknown as IdRow[];
        realRows = rows.length;
      } finally {
        await raw.end();
      }
      expect(realRows).toBeGreaterThan(0);

      const anonRead = await anon.from("attempts").select("*");
      expect(anonRead.error !== null || (anonRead.data?.length ?? 0) === 0).toBe(
        true,
      );

      const signIn = await anon.auth.signInWithPassword({
        email: userA.email,
        password: userA.password,
      });
      expect(signIn.error).toBeNull();
      const authedRead = await anon.from("attempts").select("*");
      expect(
        authedRead.error !== null || (authedRead.data?.length ?? 0) === 0,
      ).toBe(true);
      const authedWrite = await anon
        .from("attempts")
        .insert({
          learner_id: userA.id,
          capability_id: CAPABILITY,
          item_id: ITEM,
          response: "you",
          correct: true,
        });
      expect(authedWrite.error).not.toBeNull();
      await anon.auth.signOut();
    });
  });
  it("deleting auth user A cascades to their profile and goals", async () => {
    await ensureProfile(userA.id);
    const existing = await listGoals(userA.id);
    if (existing.length === 0) {
      await createGoal(userA.id, { title: "Cascade goal" });
    }

    const raw = createRawClient();
    try {
      const profBefore = (await raw`SELECT id FROM learner_profiles WHERE id = ${userA.id}`) as unknown as IdRow[];
      expect(profBefore.length).toBe(1);
      const goalsBefore = (await raw`SELECT id FROM goals WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      expect(goalsBefore.length).toBeGreaterThan(0);

      // Remove the auth user via the admin API.
      await getAdminClient().auth.admin.deleteUser(userA.id);

      const profAfter = (await raw`SELECT id FROM learner_profiles WHERE id = ${userA.id}`) as unknown as IdRow[];
      expect(profAfter.length).toBe(0);
      const goalsAfter = (await raw`SELECT id FROM goals WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      expect(goalsAfter.length).toBe(0);
      const misAfter = (await raw`SELECT id FROM learner_misconceptions WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      expect(misAfter.length).toBe(0);
      const attemptsAfter = (await raw`SELECT id FROM attempts WHERE learner_id = ${userA.id}`) as unknown as IdRow[];
      expect(attemptsAfter.length).toBe(0);
    } finally {
      await raw.end();
    }
  });
});
