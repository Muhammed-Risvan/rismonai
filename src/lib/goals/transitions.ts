export type GoalStatus = "active" | "paused" | "archived" | "completed";

/**
 * Allowed goal status transitions. archived and completed are terminal in
 * this milestone. Isomorphic module: used by the service (which enforces it)
 * and by the UI (which only uses it to decide which buttons to SHOW — the
 * server remains the authority).
 */
export const GOAL_TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  active: ["paused", "archived", "completed"],
  paused: ["active", "archived"],
  archived: [],
  completed: [],
};

export function canTransition(from: GoalStatus, to: GoalStatus): boolean {
  return GOAL_TRANSITIONS[from].includes(to);
}