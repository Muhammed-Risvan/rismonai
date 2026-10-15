/**
 * Pure core domain modules (M0).
 *
 * Everything exported here is PURE: no database, no network, no file I/O, and
 * no direct clock access. Time-dependent logic (mastery transitions, planner,
 * revision scheduling) receives the current time as an injected input. These
 * modules are the deterministic heart of the learning engine that later
 * milestones build on; the UI and services must never re-implement this logic.
 */
export {
  DEFAULT_MASTERY_POLICY,
  MASTERY_STATES,
  evaluateMastery,
  isMasteryState,
  masteryStateSchema,
  type MasteryAttempt,
  type MasteryDecision,
  type MasteryEvidence,
  type MasteryPolicy,
  type MasteryState,
} from "./mastery";
export {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  isDueForReview,
  scheduleReview,
  type ReviewSchedule,
} from "./revision";
export type { Attempt, AttemptItemRef, AttemptMode } from "./attempt";
export * from "./content";
export * from "./diagnostic";
