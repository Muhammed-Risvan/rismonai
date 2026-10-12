import type { CapabilityId } from "./identifiers";

/**
 * Recommendation contract (M0). What the planner suggests the learner do next,
 * and WHY. The planner logic that produces these lives in M8; this is only the
 * shape so UI (M7/M12) and services can build against a stable interface.
 *
 * `reason` is mandatory and human-readable: personalization must be
 * explainable, and the system must never fabricate a reason (spec.md §11).
 */
export type ActivityKind =
  | "lesson"
  | "exercise"
  | "assessment"
  | "revision"
  | "project";

export interface Recommendation {
  activityKind: ActivityKind;
  /** Id of the target lesson/exercise/assessment/revision/project. */
  targetId: string;
  capabilityId: CapabilityId;
  /** Plain-language explanation of why this is recommended now. */
  reason: string;
}
