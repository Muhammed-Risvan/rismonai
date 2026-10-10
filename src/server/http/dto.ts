import type { GoalRow, LearnerProfileRow } from "@/server/db/schema";

export function profileDto(row: LearnerProfileRow) {
  return {
    id: row.id,
    display_name: row.displayName,
    timezone: row.timezone,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function goalDto(row: GoalRow) {
  return {
    id: row.id,
    learner_id: row.learnerId,
    title: row.title,
    description: row.description,
    target_outcome: row.targetOutcome,
    status: row.status,
    deadline: row.deadline,
    hours_per_week: row.hoursPerWeek,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export type ProfileDto = ReturnType<typeof profileDto>;
export type GoalDto = ReturnType<typeof goalDto>;