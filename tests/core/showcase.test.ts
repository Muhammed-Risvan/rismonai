import { describe, expect, it } from "vitest";
import { buildShowcase } from "@content/showcase";
import { getAmbitionEntry } from "@content";
import { MASTERY_STATES } from "@/core/mastery";

/**
 * The homepage showcase must be REAL engine output, not authored strings that
 * merely look like engine output. These tests fail if the engine, the content
 * or the grading rules change underneath it — which is the point: the landing
 * page cannot quietly start lying.
 */

const showcase = buildShowcase();

describe("buildShowcase", () => {
  it("produces a non-empty, internally consistent example", () => {
    expect(showcase.goal).toBe("Become a cloud security engineer");
    expect(showcase.ambitionName).toBe("Cloud Security Engineer");
    expect(showcase.capabilities.length).toBeGreaterThan(0);
  });

  it("only emits states the engine can actually produce", () => {
    for (const capability of showcase.capabilities) {
      expect(MASTERY_STATES).toContain(capability.level);
    }
  });

  it("never claims mastery — the diagnostic ceiling is real here too", () => {
    expect(
      showcase.capabilities.some((c) => c.level === "mastered"),
    ).toBe(false);
  });

  it("shows an honest spread rather than a uniformly flattering result", () => {
    const levels = new Set(showcase.capabilities.map((c) => c.level));
    // A demo where everything passes proves nothing about the product.
    expect(levels.size).toBeGreaterThan(1);
    expect(levels.has("practising")).toBe(true);
  });

  it("uses capability titles from the reviewed content, not invented labels", () => {
    const authored = new Map(
      (getAmbitionEntry("cloud-security-engineer")?.competencyMap.capabilities ??
        []).map((capability) => [capability.id, capability.title]),
    );
    expect(authored.size).toBeGreaterThan(0);
    for (const capability of showcase.capabilities) {
      expect(capability.title).toBe(authored.get(capability.capabilityId));
    }
  });

  it("shows the engine's own justification text, never a blank reason", () => {
    for (const capability of showcase.capabilities) {
      expect(capability.reason.length).toBeGreaterThan(10);
    }
  });

  it("detects real misconceptions with authored remediation", () => {
    expect(showcase.misconceptions.length).toBeGreaterThan(0);
    const authored = new Set(
      (getAmbitionEntry("cloud-security-engineer")?.competencyMap.misconceptions ??
        []).map((m) => m.id),
    );
    for (const misconception of showcase.misconceptions) {
      expect(authored).toContain(misconception.id);
      expect(misconception.description.length).toBeGreaterThan(10);
      expect(misconception.remediation.length).toBeGreaterThan(10);
    }
  });

  it("never lists the same misconception twice", () => {
    const ids = showcase.misconceptions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic — a static page must not render differently per build", () => {
    expect(buildShowcase()).toEqual(showcase);
  });
});