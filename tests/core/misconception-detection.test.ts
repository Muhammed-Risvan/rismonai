import { describe, expect, it } from "vitest";
import {
  detectMisconception,
  gradeWithMisconception,
  type MisconceptionSignature,
} from "@/core/diagnostic/misconception";
import { cloudSecurityEngineerMap } from "@content";

/**
 * Misconception detection (pure).
 *
 * The point of this module is that a wrong answer carries a REASON. When no
 * signature matches it must return `null` ("wrong, reason unknown") rather
 * than guessing — an invented misconception is worse than an admitted gap.
 */

const SIGNATURES: readonly MisconceptionSignature[] = [
  { answer: "provider", misconceptionId: "misconception-provider-secures-everything" },
  { answer: "administrator", misconceptionId: "misconception-admin-is-safer" },
];

describe("detectMisconception", () => {
  it("maps an exact wrong answer to its misconception", () => {
    expect(detectMisconception("provider", SIGNATURES)).toBe(
      "misconception-provider-secures-everything",
    );
  });

  it("normalizes case, whitespace and padding", () => {
    expect(detectMisconception("  PROVIDER  ", SIGNATURES)).toBe(
      "misconception-provider-secures-everything",
    );
  });

  it("returns null for an answer with no signature", () => {
    expect(detectMisconception("maybe", SIGNATURES)).toBeNull();
  });

  it("returns null for an empty response", () => {
    expect(detectMisconception("   ", SIGNATURES)).toBeNull();
  });

  it("returns null when there are no signatures at all", () => {
    expect(detectMisconception("provider", [])).toBeNull();
  });
});

describe("gradeWithMisconception", () => {
  const exercise = {
    answerKey: { accepted: ["you"] },
    misconceptionSignatures: [
      { answer: "provider", misconceptionId: "misconception-provider-secures-everything" },
    ],
  };

  it("marks a correct answer correct and never attaches a misconception", () => {
    expect(gradeWithMisconception("you", exercise)).toEqual({
      correct: true,
      misconceptionId: null,
    });
  });

  it("marks a wrong answer incorrect and attaches the misconception", () => {
    expect(gradeWithMisconception("provider", exercise)).toEqual({
      correct: false,
      misconceptionId: "misconception-provider-secures-everything",
    });
  });

  it("never attaches a misconception to an unanswered item", () => {
    expect(gradeWithMisconception("", exercise)).toEqual({
      correct: false,
      misconceptionId: null,
    });
  });
});

describe("the shipped Cloud Security content is detectable", () => {
  const exercises = new Map(
    cloudSecurityEngineerMap.exercises.map((exercise) => [exercise.id, exercise]),
  );

  it.each([
    ["exercise-shared-responsibility-mcq", "provider", "misconception-provider-secures-everything"],
    ["exercise-shared-boundary-check", "provider", "misconception-provider-secures-everything"],
    ["exercise-identity-allowlist-assessment", "administrator", "misconception-admin-is-safer"],
    ["exercise-network-exposure-assessment", "public", "misconception-public-is-convenient"],
  ])("%s detects the misconception behind a wrong answer", (itemId, wrong, expected) => {
    const exercise = exercises.get(itemId);
    expect(exercise).toBeDefined();
    expect(gradeWithMisconception(wrong, exercise!)).toEqual({
      correct: false,
      misconceptionId: expected,
    });
  });

  it("every signature references a misconception authored in the same map", () => {
    const authored = new Set(
      cloudSecurityEngineerMap.misconceptions.map((misconception) => misconception.id),
    );
    for (const exercise of cloudSecurityEngineerMap.exercises) {
      for (const signature of exercise.misconceptionSignatures) {
        expect(authored).toContain(signature.misconceptionId);
      }
    }
  });
});