import type { GoalRow, LearnerProfileRow, AmbitionRow } from "@/server/db/schema";

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
    ambition_id: row.ambitionId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function ambitionDto(row: AmbitionRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    target_outcome: row.targetOutcome,
    level: row.level,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export type ProfileDto = ReturnType<typeof profileDto>;
export type GoalDto = ReturnType<typeof goalDto>;
export type AmbitionDto = ReturnType<typeof ambitionDto>;