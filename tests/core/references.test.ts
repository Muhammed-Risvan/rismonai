import { describe, expect, it } from "vitest";
import {
  assertValidReferences,
  isValidReferences,
} from "@/core/content/references";
import { InvalidCompetencyMapError } from "@/core/content/dag";
import { cloudSecurityEngineerMap } from "@content";

/**
 * M3 referential-integrity tests (pure, additive).
 *
 * Proves every objective/lesson/exercise/misconception reference resolves,
 * broken fixtures fail loudly with the offending id named, and the existing
 * seed map still validates.
 */

describe("assertValidReferences", () => {
  it("accepts the existing seed map", () => {
    expect(() => assertValidReferences(cloudSecurityEngineerMap)).not.toThrow();
    expect(isValidReferences(cloudSecurityEngineerMap)).toBe(true);
  });

  it("rejects an objective pointing at a ghost capability", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      objectives: [
        {
          id: "obj-ghost",
          title: "Ghost",
          statement: "Do the ghost thing.",
          capabilityIds: ["no-such-capability"],
        },
      ],
    };
    expect(() => assertValidReferences(broken)).toThrow(
      InvalidCompetencyMapError,
    );
    expect(() => assertValidReferences(broken)).toThrow(/no-such-capability/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a lesson pointing at a ghost objective", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      lessons: [
        {
          ...cloudSecurityEngineerMap.lessons[0],
          id: "lesson-ghost-objective",
          objectiveId: "no-such-objective",
        },
      ],
    };
    expect(() => assertValidReferences(broken)).toThrow(/no-such-objective/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a lesson pointing at a ghost capability", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      lessons: [
        {
          ...cloudSecurityEngineerMap.lessons[0],
          id: "lesson-ghost-capability",
          capabilityIds: ["no-such-capability"],
        },
      ],
    };
    expect(() => assertValidReferences(broken)).toThrow(/no-such-capability/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects an exercise pointing at a ghost capability", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: [
        {
          ...cloudSecurityEngineerMap.exercises[0],
          id: "exercise-ghost",
          capabilityIds: ["no-such-capability"],
        },
      ],
    };
    expect(() => assertValidReferences(broken)).toThrow(/no-such-capability/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a misconception pointing at a ghost capability", () => {
    // Appended rather than substituted: exercises carry signatures that
    // reference the existing misconceptions by id, so removing one would trip
    // that rule first and hide the capability check this test is about.
    const broken = {
      ...cloudSecurityEngineerMap,
      misconceptions: [
        ...cloudSecurityEngineerMap.misconceptions,
        {
          id: "misconception-ghost",
          capabilityId: "no-such-capability",
          description: "Ghost.",
          remediation: "Nothing.",
        },
      ],
    };
    expect(() => assertValidReferences(broken)).toThrow(/no-such-capability/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects an exercise signature pointing at a ghost misconception", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: cloudSecurityEngineerMap.exercises.map((exercise) =>
        exercise.id === "exercise-shared-responsibility-mcq"
          ? {
              ...exercise,
              misconceptionSignatures: [
                { answer: "provider", misconceptionId: "no-such-misconception" },
              ],
            }
          : exercise,
      ),
    };
    expect(() => assertValidReferences(broken)).toThrow(
      /no-such-misconception/,
    );
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a signature that maps a correct answer to a misconception", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: cloudSecurityEngineerMap.exercises.map((exercise) =>
        exercise.id === "exercise-shared-responsibility-mcq"
          ? {
              ...exercise,
              misconceptionSignatures: [
                {
                  answer: "you",
                  misconceptionId: "misconception-provider-secures-everything",
                },
              ],
            }
          : exercise,
      ),
    };
    expect(() => assertValidReferences(broken)).toThrow(/correct answer/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a re-probe pointing at an unknown exercise", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: cloudSecurityEngineerMap.exercises.map((exercise) =>
        exercise.id === "exercise-shared-boundary-check"
          ? { ...exercise, reprobeOf: "no-such-exercise" }
          : exercise,
      ),
    };
    expect(() => assertValidReferences(broken)).toThrow(/no-such-exercise/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects a re-probe that points forwards in the map", () => {
    // The trigger must already have been asked, otherwise the condition can
    // never fire and the probe would silently degrade to "always ask".
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: cloudSecurityEngineerMap.exercises.map((exercise) =>
        exercise.id === "exercise-shared-responsibility-mcq"
          ? {
              ...exercise,
              reprobeOf: "exercise-shared-boundary-check",
            }
          : exercise,
      ),
    };
    expect(() => assertValidReferences(broken)).toThrow(/not earlier in the map/);
    expect(isValidReferences(broken)).toBe(false);
  });

  it("rejects an exercise that re-probes itself", () => {
    const broken = {
      ...cloudSecurityEngineerMap,
      exercises: cloudSecurityEngineerMap.exercises.map((exercise) =>
        exercise.id === "exercise-shared-boundary-check"
          ? { ...exercise, reprobeOf: "exercise-shared-boundary-check" }
          : exercise,
      ),
    };
    expect(() => assertValidReferences(broken)).toThrow(/re-probes itself/);
    expect(isValidReferences(broken)).toBe(false);
  });
});
