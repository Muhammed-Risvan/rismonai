import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  isDueForReview,
  scheduleReview,
} from "@/core/revision";

/**
 * Revision scheduling tests (pure).
 *
 * The rule under test: a skill being practised comes back quickly, a
 * demonstrated skill gets a long quiet interval, and something never assessed
 * schedules no revision at all (the planner offers teaching instead).
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");
const DAY = 86_400_000;

describe("scheduleReview", () => {
  it("schedules nothing for a skill that has never been assessed", () => {
    expect(scheduleReview("untested", null, NOW).dueAt).toBeNull();
    expect(scheduleReview("unknown", null, NOW).inDays).toBeNull();
  });

  it("brings a practising skill back the next day", () => {
    const schedule = scheduleReview("practising", NOW, NOW);
    expect(schedule.inDays).toBe(1);
    expect(schedule.dueAt?.getTime()).toBe(NOW.getTime() + DAY);
  });

  it("anchors the interval to the demonstration, not to now", () => {
    const demonstrated = new Date(NOW.getTime() - 2 * DAY);
    const schedule = scheduleReview("mastered", demonstrated, NOW);
    // 14-day interval, 2 days already elapsed → due in 12.
    expect(schedule.inDays).toBe(12);
  });

  it("gives a demonstrated skill a longer quiet interval than a practising one", () => {
    const practising = scheduleReview("practising", null, NOW).inDays ?? 0;
    const demonstrated = scheduleReview("demonstrated", null, NOW).inDays ?? 0;
    const mastered = scheduleReview("mastered", null, NOW).inDays ?? 0;
    expect(practising).toBeLessThan(demonstrated);
    expect(demonstrated).toBeLessThan(mastered);
  });

  it("counts from `from` when the skill was never demonstrated", () => {
    const schedule = scheduleReview("practising", null, NOW);
    expect(schedule.inDays).toBe(1);
  });

  it("never reports a fractional zero-day wait", () => {
    const almostDue = new Date(NOW.getTime() - DAY + 6 * 60 * 60 * 1000);
    const schedule = scheduleReview("practising", almostDue, NOW);
    expect(schedule.inDays).toBe(1);
  });

  it("clamps a schedule already in the past to zero days", () => {
    const longAgo = new Date(NOW.getTime() - 100 * DAY);
    expect(scheduleReview("mastered", longAgo, NOW).inDays).toBe(0);
  });

  it("honours a per-skill override", () => {
    const schedule = scheduleReview("practising", null, NOW, {
      practising: 4,
    });
    expect(schedule.inDays).toBe(4);
  });
});

describe("isDueForReview", () => {
  it("is true exactly when the due date has passed", () => {
    const schedule = scheduleReview("practising", NOW, NOW);
    expect(isDueForReview(schedule, new Date(NOW.getTime() + DAY))).toBe(true);
    expect(isDueForReview(schedule, new Date(NOW.getTime() + DAY - 1))).toBe(false);
  });

  it("is never due when nothing is scheduled", () => {
    expect(isDueForReview(scheduleReview("untested", null, NOW), NOW)).toBe(false);
  });
});

describe("revision defaults", () => {
  it("covers every mastery state", () => {
    expect(Object.keys(DEFAULT_REVIEW_INTERVAL_DAYS)).toHaveLength(
      DEFAULT_REVIEW_INTERVAL_DAYS ? 7 : 0,
    );
  });

  it("gives every productive state a positive interval", () => {
    for (const level of [
      "introduced",
      "practising",
      "demonstrated",
      "mastered",
      "revision-needed",
    ] as const) {
      expect(DEFAULT_REVIEW_INTERVAL_DAYS[level]).toBeGreaterThan(0);
    }
  });
});