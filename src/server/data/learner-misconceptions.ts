import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import {
  learnerMisconceptions,
  type LearnerMisconceptionRow,
} from "@/server/db/schema";

/**
 * Learner misconception history data access ("remember the mistake").
 *
 * The description and remediation of a misconception live in versioned
 * content; these rows record only the learner's EXPOSURE to it, so content
 * can be corrected later without rewriting the learner's history.
 *
 * Every query is scoped by `learnerId` (supplied by the service from the
 * verified session, never from the client).
 */

export type LearnerMisconceptionInsert = {
  learnerId: string;
  capabilityId: string;
  misconceptionId: string;
  lastItemId: string;
};

/**
 * Records an encounter with a misconception.
 *
 * Idempotent per (learner, misconception): a repeated encounter increments the
 * counter and moves `lastSeenAt`, but never creates a second row and never
 * clears an existing `resolvedAt` — an old mistake is not a permanent verdict
 * on the learner, but a resolved misconception should be re-opened only by an
 * explicit decision, never silently by a repeat wrong answer.
 */
export async function recordMisconceptionEncounter(
  values: LearnerMisconceptionInsert,
  db: DbOrTx = getDb(),
): Promise<LearnerMisconceptionRow> {
  const rows = await db
    .insert(learnerMisconceptions)
    .values({ ...values, timesEncountered: 1 })
    .onConflictDoUpdate({
      target: [
        learnerMisconceptions.learnerId,
        learnerMisconceptions.misconceptionId,
      ],
      set: {
        timesEncountered: sql`${learnerMisconceptions.timesEncountered} + 1`,
        lastSeenAt: sql`now()`,
        lastItemId: values.lastItemId,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to record misconception encounter");
  }
  return row;
}

/**
 * Marks a misconception resolved. Called only when the learner later passes
 * the related item unassisted — resolution is earned, never self-declared.
 */
export async function resolveMisconception(
  learnerId: string,
  misconceptionId: string,
  db: DbOrTx = getDb(),
): Promise<LearnerMisconceptionRow | undefined> {
  const rows = await db
    .update(learnerMisconceptions)
    .set({ resolvedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(learnerMisconceptions.learnerId, learnerId),
        eq(learnerMisconceptions.misconceptionId, misconceptionId),
      ),
    )
    .returning();
  return rows[0];
}

/** Open (unresolved) misconceptions for the revision queue, oldest first. */
export async function selectOpenMisconceptions(
  learnerId: string,
  db: DbOrTx = getDb(),
): Promise<LearnerMisconceptionRow[]> {
  return db
    .select()
    .from(learnerMisconceptions)
    .where(
      and(
        eq(learnerMisconceptions.learnerId, learnerId),
        isNull(learnerMisconceptions.resolvedAt),
      ),
    );
}

/** Full misconception history (including resolved) for review screens. */
export async function selectMisconceptionsForLearner(
  learnerId: string,
  db: DbOrTx = getDb(),
): Promise<LearnerMisconceptionRow[]> {
  return db
    .select()
    .from(learnerMisconceptions)
    .where(eq(learnerMisconceptions.learnerId, learnerId));
}