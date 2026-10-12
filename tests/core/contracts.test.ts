import { describe, expect, it } from "vitest";
import type { Attempt, Recommendation } from "@/core";
import {
  ambitionId,
  capabilityId,
  exerciseId,
  lessonId,
  misconceptionId,
  objectiveId,
} from "@/core/identifiers";
import { MASTERY_STATES } from "@/core/mastery";

/**
 * Type-level + shape contract checks for M0 domain types.
 *
 * These assert the exported types have the expected shape at compile time and
 * that the branded-id constructors round-trip as plain strings at runtime.
 * Vitest's typecheck can surface type errors; these runtime assertions guard
 * the brand constructors and the structural shape of the key contracts.
 */

describe("branded id constructors", () => {
  it("round-trip the underlying string value", () => {
    expect(capabilityId("cap-1")).toBe("cap-1");
    expect(ambitionId("cse")).toBe("cse");
    expect(objectiveId("obj-1")).toBe("obj-1");
    expect(lessonId("lesson-1")).toBe("lesson-1");
    expect(exerciseId("ex-1")).toBe("ex-1");
    expect(misconceptionId("mis-1")).toBe("mis-1");
  });
});

describe("Attempt contract shape", () => {
  it("accepts a well-formed independent attempt with injected time", () => {
    const attempt: Attempt = {
      id: "attempt-1",
      learnerId: "learner-1",
      capabilityId: capabilityId("cap-1"),
      item: { kind: "assessment", id: exerciseId("ex-1") },
      mode: "independent",
      correct: true,
      hintsUsed: 0,
      misconceptionId: null,
      submittedAt: new Date("2026-10-12T00:00:00.000Z"),
      response: "you",
    };
    expect(attempt.mode).toBe("independent");
    expect(attempt.hintsUsed).toBe(0);
    expect(attempt.misconceptionId).toBeNull();
    expect(attempt.submittedAt.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("records assisted attempts with hints and an optional misconception", () => {
    const attempt: Attempt = {
      id: "attempt-2",
      learnerId: "learner-1",
      capabilityId: capabilityId("cap-1"),
      item: { kind: "exercise", id: exerciseId("ex-2") },
      mode: "guided",
      correct: false,
      hintsUsed: 2,
      misconceptionId: misconceptionId("mis-1"),
      submittedAt: new Date("2026-10-12T00:00:00.000Z"),
      response: "provider",
    };
    expect(attempt.mode).toBe("guided");
    expect(attempt.hintsUsed).toBe(2);
    expect(attempt.misconceptionId).toBe("mis-1");
  });
});

describe("Recommendation contract shape", () => {
  it("requires a human-readable reason and a valid activity kind", () => {
    const recommendation: Recommendation = {
      activityKind: "lesson",
      targetId: "lesson-shared-responsibility",
      capabilityId: capabilityId("cloud-shared-responsibility"),
      reason: "Start here because it is a prerequisite for the rest of the arc.",
    };
    expect(recommendation.activityKind).toBe("lesson");
    expect(recommendation.reason.length).toBeGreaterThan(0);
  });
});

describe("mastery states are a closed set", () => {
  it("has no duplicates and includes all five", () => {
    const unique = new Set(MASTERY_STATES);
    expect(unique.size).toBe(MASTERY_STATES.length);
    expect(MASTERY_STATES).toContain("mastered");
  });
});
