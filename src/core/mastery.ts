import { z } from "zod";

/**
 * Mastery state contract (M0). This is the single source of truth for the set
 * of mastery states used across the learning engine (mastery, planner,
 * revision, dashboard). It is pure data + a Zod enum; the transition *logic*
 * that moves between these states lives in a later milestone (M5) and must be
 * pure and tested.
 *
 * States (from spec.md §9):
 * - `unknown`         never assessed (e.g. "start at beginner")
 * - `untested`        content exists but the learner has not been assessed
 * - `developing`      some evidence, not yet independent mastery (incl. assisted)
 * - `mastered`        demonstrated independently
 * - `revision-needed` was mastered/developing but due for reinforcement
 */
export const MASTERY_STATES = [
  "unknown",
  "untested",
  "developing",
  "mastered",
  "revision-needed",
] as const;

export type MasteryState = (typeof MASTERY_STATES)[number];

export const masteryStateSchema = z.enum(MASTERY_STATES);

export function isMasteryState(value: unknown): value is MasteryState {
  return masteryStateSchema.safeParse(value).success;
}
