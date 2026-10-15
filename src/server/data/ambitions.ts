import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import {
  ambitions,
  goals,
  type AmbitionRow,
  type GoalRow,
} from "@/server/db/schema";

/**
 * Catalog data access (M1). The `ambitions` table holds reference data seeded
 * from `content/`; it is NOT learner-owned. Reads are unrestricted at the data
 * layer (catalog is the same for everyone); writes go through an idempotent
 * upsert used only by the seeder. All queries run on the server-side Drizzle
 * connection only.
 */

export type AmbitionUpsertValues = {
  id: string;
  name: string;
  description: string;
  targetOutcome: string;
  level: string;
};

/** Lists all catalog ambitions, ordered by name. */
export async function selectAmbitions(): Promise<AmbitionRow[]> {
  return getDb()
    .select()
    .from(ambitions)
    .orderBy(asc(ambitions.name));
}

/** Returns a single catalog ambition by id, or undefined. */
export async function selectAmbitionById(
  id: string,
): Promise<AmbitionRow | undefined> {
  const rows = await getDb()
    .select()
    .from(ambitions)
    .where(eq(ambitions.id, id))
    .limit(1);
  return rows[0];
}

/**
 * Idempotent upsert: creates the catalog row on first run; on conflict it
 * refreshes the mutable catalog fields (name/description/target_outcome/level)
 * and stamps updated_at, so re-running the seed keeps the catalog in sync with
 * `content/` without duplicating rows. The primary key (id) is never changed.
 */
export async function upsertAmbition(
  values: AmbitionUpsertValues,
): Promise<AmbitionRow> {
  const rows = await getDb()
    .insert(ambitions)
    .values(values)
    .onConflictDoUpdate({
      target: ambitions.id,
      set: {
        name: values.name,
        description: values.description,
        targetOutcome: values.targetOutcome,
        level: values.level,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert ambition");
  }
  return row;
}

/**
 * Links a saved goal (learner-owned) to a catalog ambition. Scoped by
 * learnerId so a learner can only link their OWN goal; returns undefined when
 * the goal does not exist or belongs to another learner (caller maps to 404).
 * Passing a null ambitionId clears the link.
 */
export async function updateGoalAmbitionForLearner(
  learnerId: string,
  goalId: string,
  ambitionId: string | null,
  db: DbOrTx = getDb(),
): Promise<GoalRow | undefined> {
  const rows = await db
    .update(goals)
    .set({ ambitionId, updatedAt: sql`now()` })
    .where(and(eq(goals.id, goalId), eq(goals.learnerId, learnerId)))
    .returning();
  return rows[0];
}
