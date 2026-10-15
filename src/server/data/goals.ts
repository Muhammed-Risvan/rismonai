import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { goals, type GoalRow, type GoalStatus } from "@/server/db/schema";

export type GoalInsertValues = {
  learnerId: string;
  title: string;
  description: string | null;
  targetOutcome: string | null;
  status: GoalStatus;
  deadline: string | null;
  hoursPerWeek: number | null;
  /** Optional catalog ambition link, written in the same insert when known. */
  ambitionId?: string | null;
};

/**
 * Pass the caller's transaction handle when inside one (e.g. onboarding,
 * which must write the goal and its ambition link atomically). The pool is
 * `max: 1`, so a nested `getDb()` call while a transaction is open would
 * self-deadlock.
 */
export async function insertGoal(
  values: GoalInsertValues,
  db: DbOrTx = getDb(),
): Promise<GoalRow> {
  const rows = await db.insert(goals).values(values).returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create goal");
  }
  return row;
}

export async function selectGoalsByLearner(
  learnerId: string,
): Promise<GoalRow[]> {
  return getDb()
    .select()
    .from(goals)
    .where(eq(goals.learnerId, learnerId))
    .orderBy(desc(goals.createdAt));
}

export async function selectGoalForLearner(
  learnerId: string,
  goalId: string,
): Promise<GoalRow | undefined> {
  const rows = await getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.learnerId, learnerId)))
    .limit(1);
  return rows[0];
}

export async function selectActiveGoalId(
  learnerId: string,
): Promise<string | undefined> {
  const rows = await getDb()
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.learnerId, learnerId), eq(goals.status, "active")))
    .limit(1);
  return rows[0]?.id;
}

export async function countActiveGoals(learnerId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.learnerId, learnerId), eq(goals.status, "active")));
  return rows.length;
}

export async function updateGoalForLearner(
  learnerId: string,
  goalId: string,
  patch: {
    title?: string;
    description?: string | null;
    targetOutcome?: string | null;
    deadline?: string | null;
    hoursPerWeek?: number | null;
  },
): Promise<GoalRow | undefined> {
  const rows = await getDb()
    .update(goals)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(goals.id, goalId), eq(goals.learnerId, learnerId)))
    .returning();
  return rows[0];
}

export async function updateGoalStatusForLearner(
  learnerId: string,
  goalId: string,
  status: GoalStatus,
): Promise<GoalRow | undefined> {
  const rows = await getDb()
    .update(goals)
    .set({ status, updatedAt: sql`now()` })
    .where(and(eq(goals.id, goalId), eq(goals.learnerId, learnerId)))
    .returning();
  return rows[0];
}