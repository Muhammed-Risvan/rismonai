import type { MasteryPolicy, MasteryState } from "../mastery";
import { evaluateMastery } from "../mastery";
import type { DiagnosticBankEntry } from "./bank";
import type { DiagnosticAnswers } from "./selection";

/**
 * M3 coverage and completion rules (pure).
 *
 * Four separate predicates — deliberately not one:
 * - capability covered: ≥1 answered item (incorrect answers count);
 * - run complete: every required capability covered AND no pending
 *   conditional remedial probe;
 * - initial level: the real mastery engine, with a `demonstrated` ceiling.
 *
 * A diagnostic run can NEVER assign `mastered`. These are starting-point
 * triage, not proficiency estimates.
 */

export function itemsForCapability(
  entries: readonly DiagnosticBankEntry[],
  capabilityId: string,
): DiagnosticBankEntry[] {
  return entries.filter((entry) => entry.capabilityId === capabilityId);
}

export function isCapabilityCovered(
  entries: readonly DiagnosticBankEntry[],
  answers: DiagnosticAnswers,
  capabilityId: string,
): boolean {
  return itemsForCapability(entries, capabilityId).some((entry) =>
    answers.has(entry.itemId),
  );
}

/**
 * Returns the pending conditional probe (trigger answered incorrectly, probe
 * unanswered), or `null` when none is pending. A pending probe blocks
 * completion: a run must never complete while a triggered remedial sits
 * unasked.
 */
export function pendingConditionalItem(
  entries: readonly DiagnosticBankEntry[],
  answers: DiagnosticAnswers,
): string | null {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  for (const entry of ordered) {
    if (entry.conditionalOn === null) {
      continue;
    }
    if (answers.has(entry.itemId)) {
      continue;
    }
    if (answers.get(entry.conditionalOn) === false) {
      return entry.itemId;
    }
  }
  return null;
}

/** A run is complete iff every required capability is covered with no pending conditional. */
export function isRunComplete(
  entries: readonly DiagnosticBankEntry[],
  requiredCapabilityIds: readonly string[],
  answers: DiagnosticAnswers,
): boolean {
  if (pendingConditionalItem(entries, answers) !== null) {
    return false;
  }
  return requiredCapabilityIds.every((capabilityId) =>
    isCapabilityCovered(entries, answers, capabilityId),
  );
}

/**
 * Diagnostic levels are NOT a separate rule: they are the mastery engine with
 * a ceiling. This is the only diagnostic-specific clause, and it exists
 * because a handful of quiz questions can never justify `mastered`
 * (spec.md §8).
 */
export const DIAGNOSTIC_CEILING: MasteryState = "demonstrated";

/**
 * Maps one capability's diagnostic answers to its initial level, by handing
 * them to the real mastery engine with a `demonstrated` ceiling.
 *
 * The ceiling is the whole point: an all-correct diagnostic run reaches
 * `demonstrated` and stops, never `mastered`.
 */
export function initialLevelFor(
  results: readonly boolean[],
  now: Date,
  policyOverrides: Partial<MasteryPolicy> = {},
): MasteryState {
  // Probes are given strictly increasing timestamps ending at `now`, in the
  // order they were asked. Order matters: the engine resets the evidence run
  // on a wrong answer, so identical timestamps would make "wrong then right"
  // indistinguishable from "wrong alone".
  const count = results.length;
  return evaluateMastery(
    {
      introducedAt: null,
      attempts: results.map((correct, index) => ({
        itemId: `diagnostic-probe-${index}`,
        correct,
        mode: "independent" as const,
        hintsUsed: 0,
        submittedAt: new Date(now.getTime() - (count - index - 1)),
      })),
    },
    now,
    { ...policyOverrides, ceiling: DIAGNOSTIC_CEILING },
  ).level;
}
