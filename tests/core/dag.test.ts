import { describe, expect, it } from "vitest";
import {
  InvalidCompetencyMapError,
  assertValidPrerequisiteDag,
  isValidPrerequisiteDag,
} from "@/core/content/dag";

/**
 * Pure unit tests for the prerequisite-DAG validator (M0).
 * Covers: valid graph, cycle, dangling reference, self-dependency, duplicate id.
 */

describe("assertValidPrerequisiteDag", () => {
  it("accepts a valid acyclic graph", () => {
    const capabilities = [
      { id: "a", prerequisites: [] },
      { id: "b", prerequisites: ["a"] },
      { id: "c", prerequisites: ["a", "b"] },
      { id: "d", prerequisites: ["c"] },
    ];
    expect(() => assertValidPrerequisiteDag(capabilities)).not.toThrow();
    expect(isValidPrerequisiteDag(capabilities)).toBe(true);
  });

  it("rejects a direct cycle with a descriptive message", () => {
    const capabilities = [
      { id: "a", prerequisites: ["b"] },
      { id: "b", prerequisites: ["a"] },
    ];
    expect(() => assertValidPrerequisiteDag(capabilities)).toThrow(
      InvalidCompetencyMapError,
    );
    expect(() => assertValidPrerequisiteDag(capabilities)).toThrow(/cycle/i);
    expect(isValidPrerequisiteDag(capabilities)).toBe(false);
  });

  it("rejects a longer cycle and names the path", () => {
    const capabilities = [
      { id: "a", prerequisites: ["c"] },
      { id: "b", prerequisites: ["a"] },
      { id: "c", prerequisites: ["b"] },
    ];
    let message = "";
    try {
      assertValidPrerequisiteDag(capabilities);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/cycle/i);
    // The reconstructed path should mention all three nodes.
    expect(message).toContain("a");
    expect(message).toContain("b");
    expect(message).toContain("c");
  });

  it("rejects a dangling prerequisite reference", () => {
    const capabilities = [{ id: "a", prerequisites: ["does-not-exist"] }];
    expect(() => assertValidPrerequisiteDag(capabilities)).toThrow(
      /dangling prerequisite/i,
    );
    expect(isValidPrerequisiteDag(capabilities)).toBe(false);
  });

  it("rejects a self-dependency", () => {
    const capabilities = [{ id: "a", prerequisites: ["a"] }];
    expect(() => assertValidPrerequisiteDag(capabilities)).toThrow(
      /depends on itself/i,
    );
    expect(isValidPrerequisiteDag(capabilities)).toBe(false);
  });

  it("rejects duplicate capability ids", () => {
    const capabilities = [
      { id: "a", prerequisites: [] },
      { id: "a", prerequisites: [] },
    ];
    expect(() => assertValidPrerequisiteDag(capabilities)).toThrow(
      /duplicate capability id/i,
    );
    expect(isValidPrerequisiteDag(capabilities)).toBe(false);
  });

  it("accepts an empty graph", () => {
    expect(() => assertValidPrerequisiteDag([])).not.toThrow();
    expect(isValidPrerequisiteDag([])).toBe(true);
  });
});
