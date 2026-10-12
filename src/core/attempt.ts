import type { CapabilityId, ExerciseId, MisconceptionId } from "./identifiers";

/**
 * Attempt contract (M0). A single graded submission by a learner.
 *
 * `mode` distinguishes guided (hints allowed) from independent work; only an
 * independent correct attempt is mastery *evidence* (see spec.md §9). The
 * mastery transition rules that consume this live in M5.
 *
 * `submittedAt` is an INJECTED timestamp: the caller supplies the current
 * time. Pure core logic must never read the clock directly, so the clock is
 * passed in rather than accessed here. No dedicated Clock abstraction is
 * introduced in M0 because no M0 logic consumes time yet (avoiding an unused
 * abstraction); the injected-time convention is established by this field.
 */
export type AttemptMode = "guided" | "independent";

export type AttemptItemRef =
  | { kind: "exercise"; id: ExerciseId }
  | { kind: "assessment"; id: ExerciseId };

export interface Attempt {
  /** Opaque attempt id (assigned by persistence in a later milestone). */
  id: string;
  /** Learner scope — sourced only from the verified session, never the client. */
  learnerId: string;
  capabilityId: CapabilityId;
  item: AttemptItemRef;
  mode: AttemptMode;
  correct: boolean;
  /** Number of hints used (0 for independent attempts). */
  hintsUsed: number;
  /** Set when the wrong answer matched a known misconception signature. */
  misconceptionId: MisconceptionId | null;
  /** Injected current time; core logic never calls the clock directly. */
  submittedAt: Date;
  /** The learner's raw response, retained as evidence. */
  response: string;
}
