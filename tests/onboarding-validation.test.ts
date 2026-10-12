import { describe, expect, it } from "vitest";
import { onboardingStartSchema } from "@/server/validation/onboarding";

const VALID = {
  ambitionId: "cloud-security-engineer",
  outcome: "Get an entry-level cloud security role within a year",
  hoursPerWeek: 6,
};

describe("onboardingStartSchema", () => {
  it("accepts a minimal valid start (SMART outcome + time + ambition)", () => {
    expect(onboardingStartSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts optional SMART extras (background + deadline)", () => {
    const parsed = onboardingStartSchema.safeParse({
      ...VALID,
      background: "No programming experience yet; comfortable with computers.",
      deadline: "2027-06-30",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an explicit null background", () => {
    expect(
      onboardingStartSchema.safeParse({ ...VALID, background: null }).success,
    ).toBe(true);
  });

  it("rejects an unknown or malformed ambition id", () => {
    expect(
      onboardingStartSchema.safeParse({ ...VALID, ambitionId: "Nope!!" })
        .success,
    ).toBe(false);
    expect(
      onboardingStartSchema.safeParse({ ...VALID, ambitionId: "" }).success,
    ).toBe(false);
    // Well-formed slug but not in the catalog passes schema validation —
    // the service maps it to NotFound (tested in the DB suite).
    expect(
      onboardingStartSchema.safeParse({
        ...VALID,
        ambitionId: "definitely-not-a-real-ambition",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing or empty outcome", () => {
    const noOutcome = {
      ambitionId: VALID.ambitionId,
      hoursPerWeek: VALID.hoursPerWeek,
    };
    expect(onboardingStartSchema.safeParse(noOutcome).success).toBe(false);
    expect(
      onboardingStartSchema.safeParse({ ...VALID, outcome: "" }).success,
    ).toBe(false);
  });

  it("rejects an outcome longer than 500 characters", () => {
    expect(
      onboardingStartSchema.safeParse({ ...VALID, outcome: "a".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      onboardingStartSchema.safeParse({ ...VALID, outcome: "a".repeat(500) })
        .success,
    ).toBe(true);
  });

  it("rejects missing, zero, fractional, or out-of-range hours", () => {
    const noHours = {
      ambitionId: VALID.ambitionId,
      outcome: VALID.outcome,
    };
    expect(onboardingStartSchema.safeParse(noHours).success).toBe(false);
    for (const bad of [0, -3, 81, 2.5, "6"]) {
      expect(
        onboardingStartSchema.safeParse({ ...VALID, hoursPerWeek: bad })
          .success,
      ).toBe(false);
    }
    expect(
      onboardingStartSchema.safeParse({ ...VALID, hoursPerWeek: 1 }).success,
    ).toBe(true);
    expect(
      onboardingStartSchema.safeParse({ ...VALID, hoursPerWeek: 80 }).success,
    ).toBe(true);
  });

  it("rejects unknown keys, including learner_id and status", () => {
    expect(
      onboardingStartSchema.safeParse({ ...VALID, learner_id: "someone-else" })
        .success,
    ).toBe(false);
    expect(
      onboardingStartSchema.safeParse({ ...VALID, status: "active" }).success,
    ).toBe(false);
  });
});
