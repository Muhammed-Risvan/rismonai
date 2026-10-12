import { ConflictError, NotFoundError } from "@/server/errors";
import { isUniqueViolation } from "@/server/db/errors";
import type { GoalRow } from "@/server/db/schema";
import { countActiveGoals, insertGoal } from "@/server/data/goals";
import { updateGoalAmbitionForLearner } from "@/server/data/ambitions";
import { requireAmbition } from "@/server/services/ambitions";
import type { OnboardingStartInput } from "@/server/validation/onboarding";

/**
 * M2 onboarding (start a first journey).
 *
 * Creates the learner's goal from their SMART-shaped onboarding input and
 * links it to the selected catalog ambition in one operation, then returns
 * the created goal. The learnerId is ALWAYS supplied by the caller from the
 * verified session — never from client input.
 *
 * - Unknown ambitionId → NotFoundError (same answer as any missing resource).
 * - Learner already has an active goal → ConflictError. Onboarding is the
 *   first-journey path; returning learners go to the dashboard, which shows
 *   their persisted selection. The database's partial unique index is the
 *   final guard against two active goals (mapped to ConflictError here too).
 */
export async function startJourney(
  learnerId: string,
  input: OnboardingStartInput,
): Promise<GoalRow> {
  // Validate the catalog id first so a bad ambition never creates a goal.
  const ambition = await requireAmbition(input.ambitionId);

  const hasActive = (await countActiveGoals(learnerId)) > 0;
  if (hasActive) {
    throw new ConflictError("A learning journey is already active");
  }

  try {
    const goal = await insertGoal({
      learnerId,
      title: ambition.name,
      description: input.background ?? null,
      targetOutcome: input.outcome,
      status: "active",
      deadline: input.deadline ?? null,
      hoursPerWeek: input.hoursPerWeek,
    });

    const linked = await updateGoalAmbitionForLearner(
      learnerId,
      goal.id,
      ambition.id,
    );
    if (!linked) {
      // Should not happen (we just created this goal for this learner);
      // surface as a server error upstream rather than a silent half-state.
      throw new Error("Failed to link the new journey to its ambition");
    }
    return linked;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      // Concurrent start: the database index rejected the second active goal.
      throw new ConflictError("A learning journey is already active");
    }
    throw error;
  }
}

