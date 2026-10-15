import { eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import type { MasteryState } from "@/core/mastery";
import {
  learnerCapabilities,
  type LearnerCapabilityRow,
} from "@/server/db/schema";

/**
 * M3 learner-capability data access (current triage levels, NOT history).
 * Scoped by learnerId on every path. The diagnostic service always passes the
 * `demonstrated` ceiling to the engine, so it never writes `mastered`
 * (service-enforced; the DB CHECK admits the full closed set).
 */

export type CapabilityLevelUpsert = {
  learnerId: string;
  capabilityId: string;
  level: MasteryState;
  source: "diagnostic" | "opt-out";
  runId: string | null;
  /**
   * How many independent passes back this level. Stored alongside the level so
   * a reviewer can always answer "what proves this?" from the row itself
   * rather than trusting the level label.
   */
  evidenceCount?: number;
  /** True when any backing pass used hints — caps the achievable level. */
  assistedPass?: boolean;
  /** When the learner last demonstrated this unassisted. */
  lastDemonstratedAt?: Date | null;
  /** When this capability is next due for revision (pure scheduler). */
  reviewAt?: Date | null;
};

/**
 * Upserts the learner's current level for one capability. Pass the caller's
 * transaction handle when inside one (e.g. the diagnostic submit/opt-out
 * transaction) so the write joins that transaction — the `max: 1` pool must
 * never be queried through `getDb()` while a transaction is open.
 */
export async function upsertCapabilityLevel(
  values: CapabilityLevelUpsert,
  db: DbOrTx = getDb(),
): Promise<LearnerCapabilityRow> {
  const rows = await db
    .insert(learnerCapabilities)
    .values(values)
    .onConflictDoUpdate({
      target: [
        learnerCapabilities.learnerId,
        learnerCapabilities.capabilityId,
      ],
      set: {
        level: values.level,
        source: values.source,
        runId: values.runId,
        updatedAt: sql`now()`,
        ...(values.evidenceCount === undefined
          ? {}
          : { evidenceCount: values.evidenceCount }),
        ...(values.assistedPass === undefined
          ? {}
          : { assistedPass: values.assistedPass }),
        ...(values.lastDemonstratedAt === undefined
          ? {}
          : { lastDemonstratedAt: values.lastDemonstratedAt }),
        ...(values.reviewAt === undefined
          ? {}
          : { reviewAt: values.reviewAt }),
      },
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to persist capability level");
  }
  return row;
}

export async function selectCapabilitiesForLearner(
  learnerId: string,
): Promise<LearnerCapabilityRow[]> {
  return getDb()
    .select()
    .from(learnerCapabilities)
    .where(eq(learnerCapabilities.learnerId, learnerId));
}
