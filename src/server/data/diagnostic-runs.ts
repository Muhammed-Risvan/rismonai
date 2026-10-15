import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import {
  diagnosticRuns,
  type DiagnosticRunRow,
} from "@/server/db/schema";

/**
 * M3 diagnostic-run data access. Every query scopes by learnerId (the
 * primary isolation guard); the composite UNIQUE (id, learner_id) + FK back
 * it at the database level. No business logic here — see services/diagnostic.
 */

export type DiagnosticRunInsert = {
  learnerId: string;
  goalId: string | null;
  ambitionId: string;
  contentVersion: string;
  itemIds: string[];
  itemsSnapshot: unknown;
  requiredCapabilityIds: string[];
};

export async function insertDiagnosticRun(
  values: DiagnosticRunInsert,
): Promise<DiagnosticRunRow> {
  const rows = await getDb()
    .insert(diagnosticRuns)
    .values({
      learnerId: values.learnerId,
      goalId: values.goalId,
      ambitionId: values.ambitionId,
      contentVersion: values.contentVersion,
      itemIds: values.itemIds,
      itemsSnapshot: values.itemsSnapshot,
      requiredCapabilityIds: values.requiredCapabilityIds,
      status: "in_progress",
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create diagnostic run");
  }
  return row;
}

export async function selectInProgressRun(
  learnerId: string,
  ambitionId: string,
): Promise<DiagnosticRunRow | undefined> {
  const rows = await getDb()
    .select()
    .from(diagnosticRuns)
    .where(
      and(
        eq(diagnosticRuns.learnerId, learnerId),
        eq(diagnosticRuns.ambitionId, ambitionId),
        eq(diagnosticRuns.status, "in_progress"),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function selectRunsByLearner(
  learnerId: string,
): Promise<DiagnosticRunRow[]> {
  return getDb()
    .select()
    .from(diagnosticRuns)
    .where(eq(diagnosticRuns.learnerId, learnerId))
    .orderBy(desc(diagnosticRuns.createdAt));
}

export async function markRunStatusForLearner(
  learnerId: string,
  runId: string,
  status: "complete" | "opted_out",
  db: DbOrTx = getDb(),
): Promise<DiagnosticRunRow | undefined> {
  const rows = await db
    .update(diagnosticRuns)
    .set({ status, completedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(diagnosticRuns.id, runId),
        eq(diagnosticRuns.learnerId, learnerId),
      ),
    )
    .returning();
  return rows[0];
}

/**
 * Selects a run with `SELECT … FOR UPDATE` — the row lock that serializes
 * concurrent submissions for the same run. MUST be passed an open
 * transaction's handle (`DbTx`): the lock is held until that transaction
 * ends, and using the pooled `getDb()` here would deadlock the `max: 1`
 * pool. Scoped by learnerId; a foreign or missing run is indistinguishable
 * (undefined — caller maps to NotFoundError).
 */
export async function selectRunForUpdate(
  learnerId: string,
  runId: string,
  db: DbOrTx,
): Promise<DiagnosticRunRow | undefined> {
  const rows = await db
    .select()
    .from(diagnosticRuns)
    .where(
      and(
        eq(diagnosticRuns.id, runId),
        eq(diagnosticRuns.learnerId, learnerId),
      ),
    )
    .for("update");
  return rows[0];
}
