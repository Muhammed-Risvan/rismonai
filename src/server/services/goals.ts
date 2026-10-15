import { ConflictError, InvalidTransitionError, NotFoundError } from "@/server/errors";
import { isUniqueViolation } from "@/server/db/errors";
import {
  GOAL_TRANSITIONS,
  canTransition,
  type GoalStatus,
} from "@/lib/goals/transitions";
import {
  countActiveGoals,
  insertGoal,
  selectActiveGoalId,
  selectGoalForLearner,
  selectGoalsByLearner,
  updateGoalForLearner,
  updateGoalStatusForLearner,
} from "@/server/data/goals";
import { requireAmbition } from "@/server/services/ambitions";
import type { GoalRow } from "@/server/db/schema";
import type {
  GoalCreateInput,
  GoalStatusChangeInput,
  GoalUpdateInput,
} from "@/server/validation/goals";
import { goalIdSchema } from "@/server/validation/goals";

// Re-exported so tests and callers have one import site.
export { GOAL_TRANSITIONS, canTransition };

function requireGoalId(goalId: string): string {
  const parsed = goalIdSchema.safeParse(goalId);
  if (!parsed.success) {
    // Malformed ids get the same answer as missing/foreign goals.
    throw new NotFoundError();
  }
  return parsed.data;
}

async function requireOwnedGoal(
  learnerId: string,
  goalId: string,
): Promise<GoalRow> {
  const goal = await selectGoalForLearner(learnerId, requireGoalId(goalId));
  if (!goal) {
    throw new NotFoundError();
  }
  return goal;
}

/**
 * The server chooses the status: 'active' when the learner has no active
 * goal yet, otherwise 'paused'. Clients cannot choose.
 *
 * An `ambition_id` is validated against the catalog BEFORE the insert, so a
 * goal is never created pointing at an ambition that does not exist. Both
 * values are written in the same insert — a goal and its ambition link are
 * one fact, not two writes that can half-complete (contrast
 * `services/onboarding.ts`, which needs two tables and therefore a
 * transaction).
 */
export async function createGoal(
  learnerId: string,
  input: GoalCreateInput,
): Promise<GoalRow> {
  if (input.ambition_id) {
    await requireAmbition(input.ambition_id);
  }
  const hasActive = (await countActiveGoals(learnerId)) > 0;
  const status: GoalStatus = hasActive ? "paused" : "active";

  try {
    return await insertGoal({
      learnerId,
      title: input.title,
      description: input.description ?? null,
      targetOutcome: input.target_outcome ?? null,
      status,
      deadline: input.deadline ?? null,
      hoursPerWeek: input.hours_per_week ?? null,
      ambitionId: input.ambition_id ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The partial unique index is the final guard against two active goals.
      throw new ConflictError();
    }
    throw error;
  }
}

export async function listGoals(learnerId: string): Promise<GoalRow[]> {
  return selectGoalsByLearner(learnerId);
}

export async function getGoal(
  learnerId: string,
  goalId: string,
): Promise<GoalRow> {
  return requireOwnedGoal(learnerId, goalId);
}

export async function updateGoal(
  learnerId: string,
  goalId: string,
  input: GoalUpdateInput,
): Promise<GoalRow> {
  const goal = await requireOwnedGoal(learnerId, goalId);

  const patch: {
    title?: string;
    description?: string | null;
    targetOutcome?: string | null;
    deadline?: string | null;
    hoursPerWeek?: number | null;
  } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.target_outcome !== undefined) patch.targetOutcome = input.target_outcome;
  if (input.deadline !== undefined) patch.deadline = input.deadline;
  if (input.hours_per_week !== undefined) patch.hoursPerWeek = input.hours_per_week;

  if (Object.keys(patch).length === 0) {
    return goal;
  }

  const updated = await updateGoalForLearner(learnerId, goal.id, patch);
  if (!updated) {
    throw new NotFoundError();
  }
  return updated;
}

export async function changeGoalStatus(
  learnerId: string,
  goalId: string,
  input: GoalStatusChangeInput,
): Promise<GoalRow> {
  const goal = await requireOwnedGoal(learnerId, goalId);
  const from = goal.status as GoalStatus;

  if (!canTransition(from, input.status)) {
    throw new InvalidTransitionError();
  }

  if (input.status === "active") {
    const activeId = await selectActiveGoalId(learnerId);
    if (activeId && activeId !== goal.id) {
      throw new ConflictError("Another goal is already active");
    }
  }

  try {
    const updated = await updateGoalStatusForLearner(
      learnerId,
      goal.id,
      input.status,
    );
    if (!updated) {
      throw new NotFoundError();
    }
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Concurrent activation: the database index rejected the second one.
      throw new ConflictError("Another goal is already active");
    }
    throw error;
  }
}