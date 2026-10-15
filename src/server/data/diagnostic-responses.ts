import { and, asc, eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import {
  diagnosticResponses,
  type DiagnosticResponseRow,
} from "@/server/db/schema";

/**
 * M3 diagnostic-response data access.
 *
 * First-answer-wins: inserts use ON CONFLICT (run_id, item_id) DO NOTHING
 * and the caller re-selects the canonical row. Responses are never updated.
 * Every read/write additionally scopes learnerId (service passes the
 * session-derived id); the composite FK (run_id, learner_id) enforces the
 * pairing at the database level.
 */

export type DiagnosticResponseInsert = {
  runId: string;
  learnerId: string;
  itemId: string;
  capabilityId: string;
  response: string;
  correct: boolean;
  /** Independence of the submission; diagnostic runs are always independent. */
  mode?: "guided" | "independent";
  /** Hints consumed while answering (0 in diagnostic mode). */
  hintsUsed?: number;
  /** Set only when a wrong answer matched a frozen misconception signature. */
  misconceptionId?: string | null;
};

/**
 * Idempotent insert-or-select: returns the persisted canonical row whether
 * this call created it or a concurrent/duplicate call did. Never updates.
 * Pass the caller's transaction handle when inside one (required for the
 * write to join that transaction — see `DbOrTx` on the pool note).
 */
export async function insertOrSelectDiagnosticResponse(
  values: DiagnosticResponseInsert,
  db: DbOrTx = getDb(),
): Promise<DiagnosticResponseRow> {
  await db
    .insert(diagnosticResponses)
    .values(values)
    .onConflictDoNothing({
      target: [diagnosticResponses.runId, diagnosticResponses.itemId],
    });
  const rows = await db
    .select()
    .from(diagnosticResponses)
    .where(
      and(
        eq(diagnosticResponses.runId, values.runId),
        eq(diagnosticResponses.itemId, values.itemId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to persist diagnostic response");
  }
  return row;
}

export async function selectResponseForLearner(
  learnerId: string,
  runId: string,
  itemId: string,
  db: DbOrTx = getDb(),
): Promise<DiagnosticResponseRow | undefined> {
  const rows = await db
    .select()
    .from(diagnosticResponses)
    .where(
      and(
        eq(diagnosticResponses.runId, runId),
        eq(diagnosticResponses.learnerId, learnerId),
        eq(diagnosticResponses.itemId, itemId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function selectResponsesForRun(
  learnerId: string,
  runId: string,
  db: DbOrTx = getDb(),
): Promise<DiagnosticResponseRow[]> {
  return db
    .select()
    .from(diagnosticResponses)
    .where(
      and(
        eq(diagnosticResponses.runId, runId),
        eq(diagnosticResponses.learnerId, learnerId),
      ),
    )
    .orderBy(asc(diagnosticResponses.createdAt));
}
