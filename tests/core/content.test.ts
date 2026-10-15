import { describe, expect, it } from "vitest";
import {
  AMBITION_CATALOG,
  cloudSecurityEngineerMap,
  getAmbitionEntry,
} from "@content";
import {
  MASTERY_STATES,
  isMasteryState,
  validateCompetencyMap,
} from "@/core";

/**
 * M0 acceptance tests:
 * - the seed Cloud Security Engineer competency map loads and validates;
 * - the catalog validates every entry on load and exposes a lookup;
 * - the shared mastery-state contract behaves;
 * - a deliberately broken map is rejected (schema + DAG).
 */

describe("seed Cloud Security Engineer competency map", () => {
  it("loads and passes full validation (shape + prerequisite DAG)", () => {
    const result = validateCompetencyMap(cloudSecurityEngineerMap);
    if (!result.ok) {
      throw new Error(`seed map failed validation: ${result.error}`);
    }
    expect(result.map.ambitionId).toBe("cloud-security-engineer");
    expect(result.map.capabilities.length).toBeGreaterThan(0);
  });

  it("has capabilities, objectives, lessons, exercises, and misconceptions", () => {
    expect(cloudSecurityEngineerMap.capabilities.length).toBeGreaterThanOrEqual(4);
    expect(cloudSecurityEngineerMap.objectives.length).toBeGreaterThanOrEqual(1);
    expect(cloudSecurityEngineerMap.lessons.length).toBeGreaterThanOrEqual(1);
    expect(cloudSecurityEngineerMap.exercises.length).toBeGreaterThanOrEqual(1);
    expect(cloudSecurityEngineerMap.misconceptions.length).toBeGreaterThanOrEqual(1);
  });

  it("references only existing objectives/capabilities (referential sanity)", () => {
    const capabilityIds = new Set(
      cloudSecurityEngineerMap.capabilities.map((c) => c.id),
    );
    const objectiveIds = new Set(
      cloudSecurityEngineerMap.objectives.map((o) => o.id),
    );
    for (const lesson of cloudSecurityEngineerMap.lessons) {
      expect(objectiveIds.has(lesson.objectiveId)).toBe(true);
      for (const capabilityId of lesson.capabilityIds) {
        expect(capabilityIds.has(capabilityId)).toBe(true);
      }
    }
    for (const exercise of cloudSecurityEngineerMap.exercises) {
      for (const capabilityId of exercise.capabilityIds) {
        expect(capabilityIds.has(capabilityId)).toBe(true);
      }
    }
  });
});

describe("ambition catalog", () => {
  it("contains the Cloud Security Engineer entry and resolves by id", () => {
    expect(AMBITION_CATALOG.length).toBeGreaterThanOrEqual(1);
    const entry = getAmbitionEntry("cloud-security-engineer");
    expect(entry).toBeDefined();
    expect(entry?.ambition.name).toBe("Cloud Security Engineer");
  });

  it("returns undefined for an unknown ambition", () => {
    expect(getAmbitionEntry("not-a-real-ambition")).toBeUndefined();
  });
});

describe("validateCompetencyMap rejects broken input", () => {
  const validMap = {
    ambitionId: "test",
    version: "1.0.0",
    lastReviewed: "2026-10-12",
    capabilities: [
      { id: "a", title: "A", summary: "s", level: "beginner", prerequisites: [] },
    ],
  };

  it("rejects a malformed map (missing required fields)", () => {
    const result = validateCompetencyMap({ ambitionId: "test" });
    expect(result.ok).toBe(false);
  });

  it("rejects a map whose prerequisites form a cycle", () => {
    const result = validateCompetencyMap({
      ...validMap,
      capabilities: [
        {
          id: "a",
          title: "A",
          summary: "s",
          level: "beginner",
          prerequisites: ["b"],
        },
        {
          id: "b",
          title: "B",
          summary: "s",
          level: "beginner",
          prerequisites: ["a"],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cycle/i);
  });

  it("rejects a map with a dangling prerequisite", () => {
    const result = validateCompetencyMap({
      ...validMap,
      capabilities: [
        {
          id: "a",
          title: "A",
          summary: "s",
          level: "beginner",
          prerequisites: ["ghost"],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dangling/i);
  });
});

describe("mastery state contract", () => {
  it("exposes exactly the documented ladder", () => {
    expect([...MASTERY_STATES]).toEqual([
      "unknown",
      "untested",
      "introduced",
      "practising",
      "demonstrated",
      "mastered",
      "revision-needed",
    ]);
  });

  it("distinguishes an unassisted demonstration from assisted practice", () => {
    expect(MASTERY_STATES).toContain("practising");
    expect(MASTERY_STATES).toContain("demonstrated");
    expect(MASTERY_STATES).not.toContain("developing");
  });

  it("recognizes valid states and rejects invalid ones", () => {
    expect(isMasteryState("mastered")).toBe(true);
    expect(isMasteryState("revision-needed")).toBe(true);
    expect(isMasteryState("nope")).toBe(false);
    expect(isMasteryState(42)).toBe(false);
  });
});
