import "server-only";

import { getAmbitionEntry, getMisconception } from "@content";
import type { CompetencyMap } from "@/core/content";
import {
  DIAGNOSTIC_CEILING,
  buildDiagnosticBank,
  isRunComplete,
  type DiagnosticBankEntry,
} from "@/core/diagnostic";
import { gradeWithMisconception } from "@/core/diagnostic/misconception";
import { nextDiagnosticItem } from "@/core/diagnostic/selection";
import {
  buildItemsSnapshot,
  diagnosticSnapshotSchema,
  type DiagnosticSnapshot,
} from "@/core/diagnostic/snapshot";
import { evaluateMastery, type MasteryState } from "@/core/mastery";
import { scheduleReview } from "@/core/revision";
import {
  insertOrSelectDiagnosticResponse,
  selectResponseForLearner,
  selectResponsesForRun,
} from "@/server/data/diagnostic-responses";
import {
  insertDiagnosticRun,
  markRunStatusForLearner,
  selectInProgressRun,
  selectRunForUpdate,
  selectRunsByLearner,
} from "@/server/data/diagnostic-runs";
import {
  selectCapabilitiesForLearner,
  upsertCapabilityLevel,
} from "@/server/data/learner-capabilities";
import {
  recordMisconceptionEncounter,
  resolveMisconception,
  selectMisconceptionsForLearner,
  selectOpenMisconceptions,
} from "@/server/data/learner-misconceptions";
import { selectActiveGoalId, selectGoalForLearner } from "@/server/data/goals";
import { getDb, type DbOrTx } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import type {
  DiagnosticResponseRow,
  DiagnosticRunRow,
  LearnerCapabilityRow,
  LearnerMisconceptionRow,
} from "@/server/db/schema";
import { ConflictError, NotFoundError } from "@/server/errors";

/**
 * M3 baseline-diagnostic service.
 *
 * Ownership: `learnerId` is ALWAYS the first argument, sourced only from
 * `requireLearner()` by the caller — never from client input. Every data
 * path scopes by it; missing/foreign runs map to NotFoundError
 * (indistinguishable). Grading and capability association derive EXCLUSIVELY
 * from the validated immutable run snapshot — client-supplied correctness,
 * capability ids, accepted answers, and learner ids are never accepted
 * (the Zod boundary in validation/diagnostic.ts rejects those keys).
 *
 * Concurrency: `submitAnswer` and `optOut` run inside a single database
 * transaction that takes a `SELECT … FOR UPDATE` row lock on the run,
 * rechecks ownership + `in_progress` status INSIDE the lock, and only then
 * reads grades and writes. Concurrent submits serialize on the lock;
 * duplicates return the canonical row; completion is always computed from
 * fresh rows read inside the same transaction (never stale data). Every
 * in-transaction query uses the transaction's own handle: the pool is
 * `max: 1`, so a nested `getDb()` call would self-deadlock.
 *
 * Client safety: every run crossing the wire goes through `toRunDto`, which
 * strips `itemsSnapshot` (accepted answers are server-only), the bank
 * internals (`itemIds`, `requiredCapabilityIds`), and `learnerId`.
 */

/** Serialized diagnostic item rendered to the client. */
export type DiagnosticItemDto = {
  itemId: string;
  prompt: string;
  position: number;
  total: number;
};

/**
 * Client-safe run DTO. `status` is CHECK-constrained at the database to
 * exactly these three values; dates are ISO-8601 strings (matching the
 * `http/dto.ts` convention).
 */
export type DiagnosticRunDto = {
  id: string;
  goalId: string | null;
  ambitionId: string;
  contentVersion: string;
  status: "in_progress" | "complete" | "opted_out";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** Maps a stored run row to its client-safe DTO (answer keys never leave). */
export function toRunDto(run: DiagnosticRunRow): DiagnosticRunDto {
  return {
    id: run.id,
    goalId: run.goalId,
    ambitionId: run.ambitionId,
    contentVersion: run.contentVersion,
    status: run.status as DiagnosticRunDto["status"],
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  };
}

/**
 * A misconception the learner has evidenced, joined with its authored
 * description + remediation. The learner's own history (count, first/last
 * seen, resolved) comes from the ledger row; the explanation comes from
 * versioned content.
 */
export type MisconceptionDto = {
  misconceptionId: string;
  capabilityId: string;
  description: string;
  remediation: string;
  timesEncountered: number;
  lastItemId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

export type DiagnosticState =
  | { status: "no-goal" }
  | { status: "no-ambition"; goalId: string }
  /** Journey linked but no run yet — the client offers "start". */
  | { status: "not_started"; goalId: string; ambitionId: string }
  | {
      status: "in_progress";
      run: DiagnosticRunDto;
      nextItem: DiagnosticItemDto | null;
      answered: number;
      total: number;
    }
  | {
      status: "complete";
      run: DiagnosticRunDto;
      levels: LearnerCapabilityRow[];
      misconceptions: MisconceptionDto[];
    }
  | {
      status: "opted_out";
      run: DiagnosticRunDto;
      levels: LearnerCapabilityRow[];
      misconceptions: MisconceptionDto[];
    };

export type SubmitAnswerResult = {
  runId: string;
  itemId: string;
  correct: boolean;
  duplicate: boolean;
  complete: boolean;
  nextItem: DiagnosticItemDto | null;
  /**
   * Set when this answer evidenced a specific authored misconception. The
   * client shows the remediation; `null` means "wrong, reason not identified",
   * which is shown honestly as such rather than as a generic failure.
   */
  misconception: MisconceptionDto | null;
};

export function parseSnapshotOrThrow(
  run: DiagnosticRunRow,
): DiagnosticSnapshot {
  const parsed = diagnosticSnapshotSchema.safeParse(run.itemsSnapshot);
  if (!parsed.success) {
    // A malformed snapshot must never grade — safe server error upstream.
    throw new Error(`Corrupt diagnostic snapshot for run ${run.id}`);
  }
  return parsed.data;
}

/**
 * Joins a learner's misconception history rows with the authored content.
 *
 * Content is the source of truth for the explanation; the ledger row is the
 * source of truth for the exposure. A slug whose content has since been
 * withdrawn is skipped rather than shown with an empty description.
 */
function toMisconceptionDtos(
  rows: readonly LearnerMisconceptionRow[],
): MisconceptionDto[] {
  const dtos: MisconceptionDto[] = [];
  for (const row of rows) {
    const authored = getMisconception(row.misconceptionId);
    if (!authored) {
      continue;
    }
    dtos.push({
      misconceptionId: row.misconceptionId,
      capabilityId: row.capabilityId,
      description: authored.description,
      remediation: authored.remediation,
      timesEncountered: row.timesEncountered,
      lastItemId: row.lastItemId,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    });
  }
  return dtos;
}

/** Full misconception history for the learner, joined with content. */
async function loadMisconceptionsForLearner(
  learnerId: string,
  db: DbOrTx = getDb(),
): Promise<MisconceptionDto[]> {
  return toMisconceptionDtos(await selectMisconceptionsForLearner(learnerId, db));
}

function snapshotEntries(snapshot: DiagnosticSnapshot): DiagnosticBankEntry[] {
  return snapshot.map((item) => ({
    itemId: item.itemId,
    capabilityId: item.capabilityId,
    position: item.position,
    conditionalOn: item.conditionalOn,
  }));
}

function answersFromResponses(
  responses: readonly DiagnosticResponseRow[],
): Map<string, boolean> {
  return new Map(responses.map((r) => [r.itemId, r.correct]));
}

function toItemDto(
  snapshot: DiagnosticSnapshot,
  itemId: string,
): DiagnosticItemDto | null {
  const entry = snapshot.find((item) => item.itemId === itemId);
  if (!entry) {
    return null;
  }
  return {
    itemId: entry.itemId,
    prompt: entry.prompt,
    position: entry.position,
    total: snapshot.length,
  };
}

/** Resolves the current (or next) item for an in-flight run. */
function toNextDto(
  snapshot: DiagnosticSnapshot,
  answers: Map<string, boolean>,
): DiagnosticItemDto | null {
  const nextId = nextDiagnosticItem(snapshotEntries(snapshot), answers);
  return nextId === null ? null : toItemDto(snapshot, nextId);
}

type ActiveJourney =
  | { status: "no-goal" }
  | { status: "no-ambition"; goalId: string }
  | { status: "linked"; goalId: string; ambitionId: string };

/** Resolves the learner's active journey (goal + linked ambition). */
async function resolveActiveJourney(learnerId: string): Promise<ActiveJourney> {
  const goalId = await selectActiveGoalId(learnerId);
  if (!goalId) {
    return { status: "no-goal" };
  }
  // Re-read scoped by learner: never trust ids across queries.
  const goal = await selectGoalForLearner(learnerId, goalId);
  if (!goal) {
    return { status: "no-goal" };
  }
  if (!goal.ambitionId) {
    return { status: "no-ambition", goalId: goal.id };
  }
  return { status: "linked", goalId: goal.id, ambitionId: goal.ambitionId };
}

/**
 * Loads the reviewed competency map for a linked ambition. The catalog row
 * is guaranteed by the goals → ambitions foreign key; the content entry is
 * what must still exist (a catalog ambition whose content was withdrawn
 * maps to the safe 404, never a half-built run).
 */
function requireCompetencyMap(ambitionId: string): CompetencyMap {
  const entry = getAmbitionEntry(ambitionId);
  if (!entry) {
    throw new NotFoundError();
  }
  return entry.competencyMap;
}

/**
 * Writes one level row per required capability through the caller's executor
 * (a transaction handle inside submit/opt-out).
 *
 * The level is NEVER computed here. Each capability's full evidence is handed
 * to the pure `evaluateMastery` engine with the `demonstrated` ceiling, so a
 * diagnostic run can never award `mastered`, and the receipts that back the
 * decision are written alongside it.
 *
 * `opt-out` records an honest `unknown` for every capability regardless of
 * evidence — declining to answer is not a gap.
 */
async function writeLevelsForRun(
  executor: DbOrTx,
  learnerId: string,
  run: DiagnosticRunRow,
  snapshot: DiagnosticSnapshot,
  responses: readonly DiagnosticResponseRow[],
  source: "diagnostic" | "opt-out",
): Promise<LearnerCapabilityRow[]> {
  // One timestamp for the whole pass, so every capability in a run is judged
  // against the same instant.
  const now = new Date();
  const levels: LearnerCapabilityRow[] = [];
  for (const capabilityId of run.requiredCapabilityIds) {
    const forCapability = responses.filter((response) => {
      const item = snapshot.find((i) => i.itemId === response.itemId);
      return item?.capabilityId === capabilityId;
    });

    const decision =
      source === "opt-out"
        ? null
        : evaluateMastery(
            {
              introducedAt: null,
              attempts: forCapability.map((response) => ({
                itemId: response.itemId,
                correct: response.correct,
                mode: response.mode as "guided" | "independent",
                hintsUsed: response.hintsUsed,
                submittedAt: response.createdAt,
              })),
            },
            now,
            { ceiling: DIAGNOSTIC_CEILING },
          );

    const level: MasteryState = decision?.level ?? "unknown";
    levels.push(
      await upsertCapabilityLevel(
        {
          learnerId,
          capabilityId,
          level,
          source,
          runId: run.id,
          evidenceCount: decision?.independentPasses ?? 0,
          assistedPass: decision?.assisted ?? false,
          lastDemonstratedAt: decision?.demonstratedAt ?? null,
          reviewAt:
            decision === null
              ? null
              : (scheduleReview(
                  decision.level,
                  decision.demonstratedAt,
                  now,
                ).dueAt ?? null),
        },
        executor,
      ),
    );
  }
  return levels;
}

/**
 * Starts (or resumes) the learner's diagnostic run for their active goal's
 * ambition. Idempotent per (learner, ambition): an existing in_progress run
 * is returned, never duplicated (the partial unique index is the final
 * guard). Returns the client-safe DTO — never the snapshot.
 */
export async function startRun(learnerId: string): Promise<DiagnosticRunDto> {
  const journey = await resolveActiveJourney(learnerId);
  if (journey.status !== "linked") {
    // No active journey, or its ambition link is missing: same 404 either way.
    throw new NotFoundError();
  }
  const { goalId, ambitionId } = journey;
  const map = requireCompetencyMap(ambitionId);

  const existing = await selectInProgressRun(learnerId, ambitionId);
  if (existing) {
    // Validate the stored snapshot on the way out too — a corrupt run
    // surfaces here rather than at grading time.
    parseSnapshotOrThrow(existing);
    return toRunDto(existing);
  }

  const bank = buildDiagnosticBank(map);
  const snapshot = buildItemsSnapshot(bank, map.exercises);
  const validated = diagnosticSnapshotSchema.parse(snapshot);

  try {
    return toRunDto(
      await insertDiagnosticRun({
        learnerId,
        goalId,
        ambitionId,
        contentVersion: map.version,
        itemIds: [...bank.itemIds],
        itemsSnapshot: validated,
        requiredCapabilityIds: [...bank.requiredCapabilityIds],
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Concurrent start: the partial unique index picked a winner — return it.
      const winner = await selectInProgressRun(learnerId, ambitionId);
      if (winner) {
        return toRunDto(winner);
      }
    }
    throw error;
  }
}

/**
 * Returns the learner's diagnostic state for the active journey.
 */
export async function getDiagnosticState(
  learnerId: string,
): Promise<DiagnosticState> {
  const journey = await resolveActiveJourney(learnerId);
  if (journey.status === "no-goal") {
    return { status: "no-goal" };
  }
  if (journey.status === "no-ambition") {
    return { status: "no-ambition", goalId: journey.goalId };
  }
  const { goalId, ambitionId } = journey;

  // Runs are already learner-scoped; narrow to this journey's ambition.
  const runs = await selectRunsByLearner(learnerId);
  const scoped = runs.filter((run) => run.ambitionId === ambitionId);

  const live = scoped.find((run) => run.status === "in_progress");
  if (live) {
    const snapshot = parseSnapshotOrThrow(live);
    const responses = await selectResponsesForRun(learnerId, live.id);
    const answers = answersFromResponses(responses);
    return {
      status: "in_progress",
      run: toRunDto(live),
      nextItem: toNextDto(snapshot, answers),
      answered: responses.length,
      total: snapshot.length,
    };
  }

  // Runs list is ordered by createdAt desc: the first terminal run is latest.
  const latest = scoped.find(
    (run) => run.status === "complete" || run.status === "opted_out",
  );
  if (latest) {
    const levels = await selectCapabilitiesForLearner(learnerId);
    const misconceptions = await loadMisconceptionsForLearner(learnerId);
    if (latest.status === "complete") {
      return { status: "complete", run: toRunDto(latest), levels, misconceptions };
    }
    return { status: "opted_out", run: toRunDto(latest), levels, misconceptions };
  }

  // Journey linked but no run yet: offer "start" honestly (never "no-goal").
  return { status: "not_started", goalId, ambitionId };
}

/**
 * Submits one answer. Concurrency-safe: the whole read-grade-write-complete
 * sequence runs inside a single transaction holding `FOR UPDATE` on the run
 * row, so concurrent submits for the same run serialize on the lock and
 * every read below sees data committed inside this transaction.
 */
export async function submitAnswer(
  learnerId: string,
  input: { runId: string; itemId: string; response: string },
): Promise<SubmitAnswerResult> {
  return getDb().transaction(async (tx) => {
    // Lock the run row first: ownership + status are rechecked INSIDE the
    // lock, so a concurrent opt-out/submit can never interleave.
    const run = await selectRunForUpdate(learnerId, input.runId, tx);
    if (!run) {
      throw new NotFoundError();
    }
    if (run.status !== "in_progress") {
      throw new ConflictError("This diagnostic run is already finished");
    }

    const snapshot = parseSnapshotOrThrow(run);
    const snapshotItem = snapshot.find((item) => item.itemId === input.itemId);
    if (!snapshotItem) {
      // Item not in this run's frozen bank — never trust client item ids.
      throw new NotFoundError();
    }

    // Grade EXCLUSIVELY from the snapshot's frozen content: the answer key AND
    // the misconception signatures, so a wrong answer carries its reason.
    const { correct, misconceptionId } = gradeWithMisconception(input.response, {
      answerKey: { accepted: snapshotItem.accepted },
      misconceptionSignatures: snapshotItem.misconceptionSignatures,
    });

    // First-answer-wins: an existing row is canonical and returned as-is
    // (correctness never mutated). Otherwise insert-or-select inside the
    // lock — a duplicate submit always converges on the persisted row.
    const existing = await selectResponseForLearner(
      learnerId,
      run.id,
      input.itemId,
      tx,
    );
    let canonical: DiagnosticResponseRow;
    let duplicate: boolean;
    let misconception: MisconceptionDto | null = null;
    if (existing) {
      canonical = existing;
      duplicate = true;
    } else {
      canonical = await insertOrSelectDiagnosticResponse(
        {
          runId: run.id,
          learnerId,
          itemId: snapshotItem.itemId,
          // Capability association comes from the snapshot, never the client.
          capabilityId: snapshotItem.capabilityId,
          response: input.response,
          correct,
          // Diagnostic submissions are independent by construction: no hints
          // are surfaced in diagnostic mode (spec.md §8).
          mode: "independent",
          hintsUsed: 0,
          misconceptionId,
        },
        tx,
      );
      // Nobody else can have inserted between the two calls: every writer
      // for this run serializes on the row lock we still hold.
      duplicate = false;
    }
    // Defense-in-depth: the composite FK (run_id, learner_id) guarantees
    // the pairing, but never hand back a row that isn't this learner's.
    if (canonical.learnerId !== learnerId) {
      throw new NotFoundError();
    }

    // Remember the mistake — but only on the first answer, so a resubmit
    // cannot inflate the encounter count. Recorded in the same transaction as
    // the response it came from.
    if (!duplicate && canonical.misconceptionId) {
      const encounter = await recordMisconceptionEncounter(
        {
          learnerId,
          capabilityId: canonical.capabilityId,
          misconceptionId: canonical.misconceptionId,
          lastItemId: canonical.itemId,
        },
        tx,
      );
      misconception = toMisconceptionDtos([encounter])[0] ?? null;
    } else if (canonical.misconceptionId) {
      // Duplicate submit: still explain the mistake, without re-counting it.
      const existing = await selectMisconceptionsForLearner(learnerId, tx);
      misconception =
        toMisconceptionDtos(
          existing.filter(
            (row) => row.misconceptionId === canonical.misconceptionId,
          ),
        )[0] ?? null;
    }

    // Resolution is earned: passing the SAME item that revealed the
    // misunderstanding unassisted clears it. A duplicate (already-recorded)
    // correct answer does not, so replaying an old pass cannot fake progress.
    if (canonical.correct && canonical.mode === "independent" && canonical.hintsUsed === 0) {
      const open = (await selectOpenMisconceptions(learnerId, tx)).filter(
        (row) => row.lastItemId === canonical.itemId,
      );
      for (const row of open) {
        await resolveMisconception(learnerId, row.misconceptionId, tx);
      }
    }

    // Re-read ALL responses inside the transaction (fresh, never stale) and
    // recompute coverage/completion from canonical data only.
    const allResponses = await selectResponsesForRun(
      learnerId,
      run.id,
      tx,
    );
    const answers = answersFromResponses(allResponses);
    const complete = isRunComplete(
      snapshotEntries(snapshot),
      run.requiredCapabilityIds,
      answers,
    );

    if (complete) {
      const finished = await markRunStatusForLearner(
        learnerId,
        run.id,
        "complete",
        tx,
      );
      if (!finished) {
        throw new NotFoundError();
      }
      // Levels derive from the canonical responses just read, in the SAME
      // transaction as the status flip — never a half-finished run.
      await writeLevelsForRun(
        tx,
        learnerId,
        run,
        snapshot,
        allResponses,
        "diagnostic",
      );
    }

    return {
      runId: run.id,
      itemId: canonical.itemId,
      correct: canonical.correct,
      duplicate,
      complete,
      nextItem: complete ? null : toNextDto(snapshot, answers),
      misconception,
    };
  });
}

/**
 * Explicit opt-out: completes the run with every required capability set to
 * `unknown` (honest, not assumed). Terminal — further submits are rejected.
 * Runs in one transaction: status flip + level writes commit together.
 */
export async function optOut(
  learnerId: string,
  runId: string,
): Promise<DiagnosticRunDto> {
  return getDb().transaction(async (tx) => {
    const run = await selectRunForUpdate(learnerId, runId, tx);
    if (!run) {
      throw new NotFoundError();
    }
    if (run.status !== "in_progress") {
      throw new ConflictError("This diagnostic run is already finished");
    }
    // A malformed snapshot must never drive any write — not even opt-out.
    const snapshot = parseSnapshotOrThrow(run);

    const updated = await markRunStatusForLearner(
      learnerId,
      run.id,
      "opted_out",
      tx,
    );
    if (!updated) {
      throw new NotFoundError();
    }
    await writeLevelsForRun(tx, learnerId, run, snapshot, [], "opt-out");
    return toRunDto(updated);
  });
}

/**
 * Reassessment: starts a NEW run on the current content version. All prior
 * runs and responses are preserved; levels change only when the new run
 * completes or opts out.
 *
 * If a run is already in flight there is nothing to reassess yet, so the
 * in-flight run is returned unchanged rather than silently discarded or
 * duplicated — the learner finishes it first. (This is what `startRun` does;
 * the explicit wrapper documents the intent and gives one place to change it
 * if reassessment should ever abandon a partial run.)
 */
export async function reassess(learnerId: string): Promise<DiagnosticRunDto> {
  return startRun(learnerId);
}
