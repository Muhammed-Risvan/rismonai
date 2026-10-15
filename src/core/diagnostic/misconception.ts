import type { Exercise } from "../content/schema";
import {
  gradeDiagnosticAnswer,
  normalizeDiagnosticResponse,
} from "./grading";

/**
 * Misconception detection (pure).
 *
 * A wrong answer is only useful if you know *why* it was wrong. This module
 * maps the learner's actual response onto the content-authored
 * `misconceptionSignatures` so the reason is recoverable instead of being
 * discarded as `correct: false`.
 *
 * Deterministic and content-driven: no AI, no heuristics, no guessing. An
 * answer with no matching signature returns `null` ("wrong, reason unknown"),
 * which is an honest result — it is never upgraded into a guess.
 */

/** Signature shape kept local so this module needs no schema import. */
export type MisconceptionSignature = Exercise["misconceptionSignatures"][number];

export interface MisconceptionLookup {
  readonly itemId: string;
  readonly capabilityId: string;
  readonly signatures: readonly MisconceptionSignature[];
}

/**
 * Returns the misconception id evidenced by `response`, or `null`.
 *
 * Only ever called for an INCORRECT answer — a correct answer never
 * evidences a misconception, and a signature naming an accepted answer is
 * rejected at content-validation time.
 *
 * When several signatures match (should not happen with well-authored
 * content) the first in authored order wins, so the result is deterministic.
 */
export function detectMisconception(
  response: string,
  signatures: readonly MisconceptionSignature[],
): string | null {
  const normalized = normalizeDiagnosticResponse(response);
  if (normalized === "") {
    return null;
  }
  for (const signature of signatures) {
    if (normalizeDiagnosticResponse(signature.answer) === normalized) {
      return signature.misconceptionId;
    }
  }
  return null;
}

/**
 * Grades a response and reports both the correctness and the misconception it
 * evidences. Single entry point for submission handling, so a correct answer
 * can never be paired with a misconception by accident.
 */
export function gradeWithMisconception(
  response: string,
  exercise: Pick<Exercise, "answerKey" | "misconceptionSignatures">,
): { correct: boolean; misconceptionId: string | null } {
  const correct = gradeDiagnosticAnswer(
    response,
    exercise.answerKey.accepted,
  );
  if (correct) {
    return { correct: true, misconceptionId: null };
  }
  return {
    correct: false,
    misconceptionId: detectMisconception(
      response,
      exercise.misconceptionSignatures,
    ),
  };
}