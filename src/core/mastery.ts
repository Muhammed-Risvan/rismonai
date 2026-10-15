import { z } from "zod";

/**
 * The mastery engine (pure).
 *
 * This is the rule that decides what a learner has actually demonstrated, and
 * it is deliberately the ONLY place that decision is made. It is a pure
 * function of recorded evidence and an injected `now` — it never reads the
 * clock, never touches the database, and never asks an AI.
 *
 * The ladder (from the product spec, §7 "evidence-first learning"):
 *
 *   unknown       never assessed (the learner opted out) — honest, not a gap
 *   untested      content exists but the learner has not been assessed yet
 *   introduced    taught, but not yet practised
 *   practising    some evidence, none of it independent — including assisted
 *   demonstrated   shown once, independently
 *   mastered      shown independently, repeatedly, and across items
 *   revision-needed  previously demonstrated, now due for reinforcement
 *
 * The load-bearing distinction is `practising` vs `demonstrated`. Getting it
 * right *with hints* is progress. Getting it right *alone* is evidence. A
 * learner who needed three hints has not demonstrated anything, and the engine
 * refuses to pretend otherwise.
 */

export const MASTERY_STATES = [
  "unknown",
  "untested",
  "introduced",
  "practising",
  "demonstrated",
  "mastered",
  "revision-needed",
] as const;

export type MasteryState = (typeof MASTERY_STATES)[number];

export const masteryStateSchema = z.enum(MASTERY_STATES);

export function isMasteryState(value: unknown): value is MasteryState {
  return masteryStateSchema.safeParse(value).success;
}

/**
 * Ordering used only to apply a `ceiling`. It is NOT a claim that every state
 * is "better" than the one below it in every sense — `revision-needed` sits
 * high deliberately, because a lapsed demonstration outranks a first attempt.
 */
const STATE_RANK: Record<MasteryState, number> = {
  unknown: 0,
  untested: 1,
  introduced: 2,
  practising: 3,
  demonstrated: 4,
  mastered: 5,
  "revision-needed": 6,
};

const MS_PER_DAY = 86_400_000;

/**
 * Tunable thresholds. A capability can override them (some skills need more
 * reps than others); `DEFAULT_MASTERY_POLICY` is the sensible baseline.
 */
export interface MasteryPolicy {
  /** Independent passes required before `mastered`. */
  masterPasses: number;
  /** Distinct items that must each have been passed independently. */
  masterDistinctItems: number;
  /** Independent passes required before `demonstrated`. */
  demonstratePasses: number;
  /** Days after a demonstration before it decays to `revision-needed`. */
  reviewAfterDays: number;
  /**
   * Optional hard ceiling on the returned state. The diagnostic passes
   * `demonstrated`: a few quiz questions can never justify `mastered`.
   */
  ceiling?: MasteryState;
}

export const DEFAULT_MASTERY_POLICY: MasteryPolicy = {
  masterPasses: 2,
  masterDistinctItems: 2,
  demonstratePasses: 1,
  reviewAfterDays: 14,
};

/** One graded submission, as recorded in the evidence ledger. */
export interface MasteryAttempt {
  itemId: string;
  correct: boolean;
  mode: "guided" | "independent";
  hintsUsed: number;
  submittedAt: Date;
}

export interface MasteryEvidence {
  /** When the learner was first taught this capability; null if never. */
  introducedAt: Date | null;
  attempts: readonly MasteryAttempt[];
}

export interface MasteryDecision {
  level: MasteryState;
  /** Human-readable justification — surfaced in the UI, never hidden. */
  reason: string;
  /** Independent correct passes backing this decision. */
  independentPasses: number;
  /** Distinct items passed independently. */
  distinctItems: number;
  /** Whether any backing pass used assistance. */
  assisted: boolean;
  /** When the learner last demonstrated this unassisted, if ever. */
  demonstratedAt: Date | null;
}

/** A correct answer counts only if nothing helped the learner. */
function isIndependentPass(attempt: MasteryAttempt): boolean {
  return attempt.correct && attempt.mode === "independent" && attempt.hintsUsed === 0;
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

/**
 * Applies a promotion ceiling.
 *
 * The ceiling answers exactly one question: "how high may THIS run promote a
 * skill?" (the diagnostic passes `demonstrated`, so it can never award
 * `mastered`).
 *
 * `revision-needed` is deliberately exempt. It is not a promotion — it reports
 * that previously earned evidence has gone stale, which is a fact about WHEN
 * the evidence was earned, not about how high this run rated the skill.
 * Ranking it against the ceiling would silently erase the decay signal and
 * present a long-lapsed skill as freshly demonstrated.
 */
function cap(level: MasteryState, ceiling: MasteryState | undefined): MasteryState {
  if (ceiling === undefined || level === "revision-needed") {
    return level;
  }
  return STATE_RANK[level] <= STATE_RANK[ceiling] ? level : ceiling;
}

/**
 * The single decision function. Given everything ever recorded about one
 * capability, returns the state it is in now — and why.
 *
 * Pure: `now` is injected. Deterministic: the same evidence always yields the
 * same answer, which is what makes it testable and auditable.
 */
export function evaluateMastery(
  evidence: MasteryEvidence,
  now: Date,
  policyOverrides: Partial<MasteryPolicy> = {},
): MasteryDecision {
  const policy: MasteryPolicy = { ...DEFAULT_MASTERY_POLICY, ...policyOverrides };
  const { attempts, introducedAt } = evidence;

  // 1. Nothing recorded at all.
  if (attempts.length === 0 && introducedAt === null) {
    return {
      level: cap("untested", policy.ceiling),
      reason: "Not assessed yet — this is unknown, not a gap.",
      independentPasses: 0,
      distinctItems: 0,
      assisted: false,
      demonstratedAt: null,
    };
  }

  // 2. Taught but never attempted.
  if (attempts.length === 0) {
    return {
      level: cap("introduced", policy.ceiling),
      reason: "You have been shown this but have not tried it yet.",
      independentPasses: 0,
      distinctItems: 0,
      assisted: false,
      demonstratedAt: null,
    };
  }

  // Chronological order, established ONCE and used for every decision below.
  //
  // `Array.prototype.sort` is stable (ES2019), so attempts sharing a timestamp
  // keep the caller's order. That matters because persisted
  // `diagnostic_responses.created_at` uses `now()`, which is transaction-scoped
  // in PostgreSQL: two rows can share a microsecond. Comparing raw timestamps
  // would make the failure-reset boundary ambiguous and silently DISCARD a
  // correct answer that followed a tied wrong one. Position is therefore the
  // authority for ordering, and the caller's input order is the tiebreak —
  // never a hash or a random id, which would invent an order that never
  // happened.
  const ordered = [...attempts].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
  );

  // The most recent attempt, and the most recent wrong one. A failure RESETS
  // the evidence run: passing an item once, failing a month later, then
  // passing a different item next week must NOT add up to "mastered" — the
  // older demonstration no longer speaks for the learner.
  const mostRecent = ordered[ordered.length - 1];
  const lastFailureIndex = ordered.findLastIndex((a) => !a.correct);

  /** Passes BEFORE the reset — kept only to explain a reopen to the learner. */
  const everIndependent = ordered.filter(isIndependentPass);

  const independent = ordered.filter(
    (attempt, index) => isIndependentPass(attempt) && index > lastFailureIndex,
  );
  const assisted = ordered.some((a) => a.correct && !isIndependentPass(a));
  const distinctItems = new Set(independent.map((a) => a.itemId)).size;
  const demonstratedAt =
    independent.length > 0
      ? new Date(Math.max(...independent.map((a) => a.submittedAt.getTime())))
      : null;

  const base = {
    independentPasses: independent.length,
    distinctItems,
    assisted,
    demonstratedAt,
  };

  // 1. Nothing recorded at all.
  if (attempts.length === 0 && introducedAt === null) {
    return {
      ...base,
      level: cap("untested", policy.ceiling),
      reason: "Not assessed yet — this is unknown, not a gap.",
    };
  }

  // 2. Taught but never attempted.
  if (attempts.length === 0) {
    return {
      ...base,
      level: cap("introduced", policy.ceiling),
      reason: "You have been shown this but have not tried it yet.",
    };
  }

  // 3. A wrong answer after a demonstration REOPENS the skill. The reset has
  //    already emptied `independent`, so this is checked against the full
  //    history: "you had this, then you got it wrong" is worth saying out
  //    loud, because it explains why the level went down.
  if (demonstratedAt === null && everIndependent.length > 0 && !mostRecent.correct) {
    return {
      ...base,
      level: cap("practising", policy.ceiling),
      reason:
        "You answered this correctly before, but got it wrong most recently — so it goes back to practice.",
    };
  }

  if (demonstratedAt !== null) {
    const lapsed = daysBetween(demonstratedAt, now) >= policy.reviewAfterDays;

    if (
      independent.length >= policy.masterPasses &&
      distinctItems >= policy.masterDistinctItems
    ) {
      return lapsed
        ? {
            ...base,
            level: cap("revision-needed", policy.ceiling),
            reason: "You demonstrated this across several items, and it is due for a refresh.",
          }
        : {
            ...base,
            level: cap("mastered", policy.ceiling),
            reason: "You demonstrated this independently, more than once, across different items.",
          };
    }

    if (independent.length >= policy.demonstratePasses) {
      return lapsed
        ? {
            ...base,
            level: cap("revision-needed", policy.ceiling),
            reason: "You demonstrated this once, and it is now due for reinforcement.",
          }
        : {
            ...base,
            level: cap("demonstrated", policy.ceiling),
            reason: "You answered this correctly on your own, once.",
          };
    }
  }

  // 4. Some evidence, none of it independent.
  if (attempts.length > 0) {
    return {
      ...base,
      level: cap("practising", policy.ceiling),
      reason: assisted
        ? "You got this right with help — that is progress, but it is not yet proof."
        : "You have tried this but not yet got it right unaided.",
    };
  }

  // Unreachable: every path above consumes a non-empty attempt list.
  return { ...base, level: cap("untested", policy.ceiling), reason: "Not assessed yet." };
}