import type { MasteryState } from "./mastery";

/**
 * Revision scheduling (pure).
 *
 * When should this capability come back? The answer is a function of the state
 * and the moment it was last demonstrated — never a hardcoded cron job, and
 * never a read of the system clock (the current time is injected).
 *
 * Intervals are deliberately short early and longer late: a skill being
 * practised needs many quick returns, while a demonstrated skill needs a long
 * quiet interval before it is worth revisiting.
 */

const MS_PER_DAY = 86_400_000;

/** Days before a capability in each state should be revisited. */
export const DEFAULT_REVIEW_INTERVAL_DAYS: Record<MasteryState, number> = {
  // Never assessed: no revision is scheduled. The planner offers first
  // teaching instead, which is a different activity.
  unknown: 0,
  untested: 0,
  introduced: 1,
  practising: 1,
  demonstrated: 3,
  mastered: 14,
  "revision-needed": 1,
};

export interface ReviewSchedule {
  /** When this capability is next due; null when no revision is scheduled. */
  dueAt: Date | null;
  /** Whole days from `from` until due; null when unscheduled. */
  inDays: number | null;
}

/**
 * Schedules the next review for a capability.
 *
 * `demonstratedAt` anchors the interval. When it is missing (the capability
 * was never demonstrated — it is new, or was never got right), the interval
 * is counted from `from` instead, so an unscheduled skill still returns
 * promptly rather than never.
 */
export function scheduleReview(
  level: MasteryState,
  demonstratedAt: Date | null,
  from: Date,
  overrides: Partial<Record<MasteryState, number>> = {},
): ReviewSchedule {
  const days = overrides[level] ?? DEFAULT_REVIEW_INTERVAL_DAYS[level];
  if (days <= 0) {
    return { dueAt: null, inDays: null };
  }
  const anchor = demonstratedAt ?? from;
  const dueAt = new Date(anchor.getTime() + days * MS_PER_DAY);
  // Reported in whole days, rounded up: a due date 6 hours out is "in 1 day",
  // never the misleading "in 0 days".
  const inDays = Math.max(0, Math.ceil((dueAt.getTime() - from.getTime()) / MS_PER_DAY));
  return { dueAt, inDays };
}

/** True when the capability is due for review at `now`. Pure. */
export function isDueForReview(schedule: ReviewSchedule, now: Date): boolean {
  return schedule.dueAt !== null && schedule.dueAt.getTime() <= now.getTime();
}