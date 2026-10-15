/**
 * Attempt contract — the evidence ledger (pure type only).
 *
 * An `Attempt` is ONE graded submission by a learner on ONE item. Together
 * these rows are the evidence that mastery, revision and the planner are
 * derived from — never a "lesson completed" flag.
 *
 * Two invariants this contract exists to protect:
 *
 * 1. **Independence is recorded, not assumed.** `hintsUsed > 0` and
 *    `mode === "guided"` both mean the attempt is *assisted*. Only an
 *    independent correct attempt is eligible to count as mastery evidence;
 *    assisted passes still count as progress toward `demonstrated`.
 *
 * 2. **A misconception is the reason, never a side effect.** `misconceptionId`
 *    is populated only when the response matched an authored
 *    `misconceptionSignatures` entry on the exercise, and only when the answer
 *    was wrong. `null` means "wrong, reason not identified" — an honest gap,
 *    never a guess (see `diagnostic/misconception.ts`).
 *
 * `submittedAt` is an INJECTED timestamp: the caller supplies the current
 * time. Pure core logic must never read the clock directly, so the clock is
 * passed in rather than accessed here.
 */

/** How much assistance the learner had on this submission. */
export type AttemptMode = "guided" | "independent";

/** What kind of item was attempted. */
export type AttemptItemRef =
  | { kind: "exercise"; id: string }
  | { kind: "assessment"; id: string };

/** Whether an attempt is eligible to count as mastery evidence. */
export function isIndependentPass(attempt: {
  correct: boolean;
  mode: AttemptMode;
  hintsUsed: number;
}): boolean {
  return attempt.correct && attempt.mode === "independent" && attempt.hintsUsed === 0;
}

export interface Attempt {
  /** Opaque attempt id (assigned by persistence). */
  id: string;
  /** Learner scope — sourced only from the verified session, never the client. */
  learnerId: string;
  capabilityId: string;
  item: AttemptItemRef;
  mode: AttemptMode;
  correct: boolean;
  /** Number of hints used. Must be 0 when `mode` is `independent`. */
  hintsUsed: number;
  /** Set only when a wrong answer matched an authored misconception signature. */
  misconceptionId: string | null;
  /** Injected current time; core logic never calls the clock directly. */
  submittedAt: Date;
  /** The learner's raw response, retained as evidence. */
  response: string;
}