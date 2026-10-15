import { AMBITION_CATALOG } from "@content";
import { NotFoundError } from "@/server/errors";
import {
  selectAmbitionById,
  selectAmbitions,
  updateGoalAmbitionForLearner,
  upsertAmbition,
  type AmbitionUpsertValues,
} from "@/server/data/ambitions";
import { goalIdSchema } from "@/server/validation/goals";
import type { AmbitionRow, GoalRow } from "@/server/db/schema";

/**
 * Catalog ambition services (M1). Catalog reads are not learner-scoped (the
 * catalog is identical for everyone). Linking a goal to an ambition is
 * learner-scoped and enforces ownership the same way goals do.
 */

/**
 * Lists all catalog ambitions (not learner-scoped), self-seeding the catalog
 * from `content/` when it is out of sync.
 *
 * The ambitions table is reference data derived from versioned content, so a
 * fresh database would otherwise render an empty picker and onboarding would
 * be impossible. Seeding is idempotent (upsert by stable slug), and the cheap
 * guard below means a healthy catalog costs exactly one SELECT with no writes.
 */
export async function listAmbitions(): Promise<AmbitionRow[]> {
  const rows = await selectAmbitions();
  const present = new Set(rows.map((row) => row.id));
  const missing = AMBITION_CATALOG.filter(
    (entry) => !present.has(entry.ambition.id),
  );
  if (missing.length === 0) {
    return rows;
  }
  for (const entry of missing) {
    await seedAmbition({
      id: entry.ambition.id,
      name: entry.ambition.name,
      description: entry.ambition.description,
      targetOutcome: entry.ambition.targetOutcome,
      level: entry.ambition.level,
    });
  }
  return selectAmbitions();
}

/** Returns one catalog ambition or throws NotFound (used when linking). */
export async function requireAmbition(ambitionId: string): Promise<AmbitionRow> {
  const row = await selectAmbitionById(ambitionId);
  if (!row) {
    throw new NotFoundError();
  }
  return row;
}

/** Idempotent upsert used by the seeder (server-side only). */
export async function seedAmbition(
  values: AmbitionUpsertValues,
): Promise<AmbitionRow> {
  return upsertAmbition(values);
}

/**
 * Links a saved goal to a catalog ambition (or clears it with null).
 *
 * Ownership: the goal must belong to the authenticated learner; a malformed id
 * or a foreign/missing goal returns NotFoundError (never distinguished). The
 * ambition must exist in the catalog. The learnerId is ALWAYS supplied by the
 * caller from the verified session — never from client input.
 */
export async function setGoalAmbition(
  learnerId: string,
  goalId: string,
  ambitionId: string | null,
): Promise<GoalRow> {
  const parsedGoalId = goalIdSchema.safeParse(goalId);
  if (!parsedGoalId.success) {
    throw new NotFoundError();
  }

  if (ambitionId !== null) {
    await requireAmbition(ambitionId);
  }

  const updated = await updateGoalAmbitionForLearner(
    learnerId,
    parsedGoalId.data,
    ambitionId,
  );
  if (!updated) {
    // Goal missing or owned by another learner — same answer either way.
    throw new NotFoundError();
  }
  return updated;
}
