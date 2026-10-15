import { describe, expect, it } from "vitest";
import type { Attempt } from "@/core";
import { isIndependentPass } from "@/core/attempt";
import { MASTERY_STATES } from "@/core/mastery";

/**
 * Contract checks for the M0 domain types.
 *
 * These guard the *meaning* of the evidence contracts, not just their
 * structural shape. The important invariant is that an assisted answer can
 * never silently count as mastery evidence.
 */

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    learnerId: "learner-1",
    capabilityId: "cloud-shared-responsibility",
    item: { kind: "assessment", id: "exercise-1" },
    mode: "independent",
    correct: true,
    hintsUsed: 0,
    misconceptionId: null,
    submittedAt: new Date("2026-10-12T00:00:00.000Z"),
    response: "you",
    ...overrides,
  };
}

describe("Attempt contract shape", () => {
  it("accepts a well-formed independent attempt with injected time", () => {
    const attempt = makeAttempt();
    expect(attempt.mode).toBe("independent");
    expect(attempt.hintsUsed).toBe(0);
    expect(attempt.misconceptionId).toBeNull();
    expect(attempt.submittedAt.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("records assisted attempts with hints and an optional misconception", () => {
    const attempt = makeAttempt({
      id: "attempt-2",
      item: { kind: "exercise", id: "exercise-2" },
      mode: "guided",
      correct: false,
      hintsUsed: 2,
      misconceptionId: "misconception-provider-secures-everything",
      response: "provider",
    });
    expect(attempt.mode).toBe("guided");
    expect(attempt.hintsUsed).toBe(2);
    expect(attempt.misconceptionId).toBe(
      "misconception-provider-secures-everything",
    );
  });
});

describe("isIndependentPass — the mastery-evidence gate", () => {
  it("counts a correct, unassisted attempt as evidence", () => {
    expect(isIndependentPass(makeAttempt())).toBe(true);
  });

  it("rejects an incorrect attempt", () => {
    expect(isIndependentPass(makeAttempt({ correct: false }))).toBe(false);
  });

  it("rejects a guided attempt even when correct", () => {
    expect(isIndependentPass(makeAttempt({ mode: "guided" }))).toBe(false);
  });

  it("rejects an independent attempt that consumed a hint", () => {
    expect(isIndependentPass(makeAttempt({ hintsUsed: 1 }))).toBe(false);
  });

  it("rejects an attempt that is both guided and correct", () => {
    expect(
      isIndependentPass(makeAttempt({ mode: "guided", correct: true })),
    ).toBe(false);
  });
});

describe("mastery states are a closed set", () => {
  it("has no duplicates and includes the terminal state", () => {
    const unique = new Set(MASTERY_STATES);
    expect(unique.size).toBe(MASTERY_STATES.length);
    expect(MASTERY_STATES).toContain("mastered");
  });
});