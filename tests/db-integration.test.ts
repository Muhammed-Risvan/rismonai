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
    } finally {
      await raw.end();
    }
  });
});
