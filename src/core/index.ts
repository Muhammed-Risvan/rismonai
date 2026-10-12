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
  ambitionId,
  capabilityId,
  exerciseId,
  lessonId,
  misconceptionId,
  objectiveId,
  type AmbitionId,
  type CapabilityId,
  type ExerciseId,
  type LessonId,
  type MisconceptionId,
  type ObjectiveId,
} from "./identifiers";
export {
  MASTERY_STATES,
  isMasteryState,
  masteryStateSchema,
  type MasteryState,
} from "./mastery";
export type { Attempt, AttemptItemRef, AttemptMode } from "./attempt";
export type { ActivityKind, Recommendation } from "./recommendation";
export * from "./content";
