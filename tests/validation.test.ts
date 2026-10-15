import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "@/lib/timezone";
import {
  diagnosticAnswerSchema,
  diagnosticOptOutSchema,
} from "@/server/validation/diagnostic";
import {
  goalCreateSchema,
  goalStatusChangeSchema,
  goalUpdateSchema,
} from "@/server/validation/goals";
import { profileUpdateSchema } from "@/server/validation/profile";

describe("profileUpdateSchema", () => {
  it("accepts a valid display name and timezone", () => {
    expect(
      profileUpdateSchema.safeParse({
        display_name: "Ada",
        timezone: "Europe/London",
      }).success,
    ).toBe(true);
  });

  it("accepts a null display name", () => {
    expect(profileUpdateSchema.safeParse({ display_name: null }).success).toBe(
      true,
    );
  });

  it("rejects unknown keys, including learner_id", () => {
    expect(
      profileUpdateSchema.safeParse({
        display_name: "Ada",
        learner_id: "someone-else",
      }).success,
    ).toBe(false);
    expect(profileUpdateSchema.safeParse({ learner_id: "x" }).success).toBe(
      false,
    );
  });

  it("rejects display_name longer than 80 characters", () => {
    expect(
      profileUpdateSchema.safeParse({ display_name: "a".repeat(81) }).success,
    ).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ display_name: "a".repeat(80) }).success,
    ).toBe(true);
  });

  it("rejects an invalid timezone", () => {
    expect(profileUpdateSchema.safeParse({ timezone: "Not/AZone" }).success).toBe(
      false,
    );
    expect(profileUpdateSchema.safeParse({ timezone: "" }).success).toBe(false);
  });
});

describe("goalCreateSchema", () => {
  it("accepts a minimal goal", () => {
    expect(goalCreateSchema.safeParse({ title: "Learn piano" }).success).toBe(
      true,
    );
  });

  it("accepts a fully specified goal", () => {
    expect(
      goalCreateSchema.safeParse({
        title: "Learn piano",
        description: "Practice daily",
        target_outcome: "Play 3 songs",
        deadline: "2026-12-31",
        hours_per_week: 5,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys, including learner_id", () => {
    expect(
      goalCreateSchema.safeParse({ title: "x", learner_id: "y" }).success,
    ).toBe(false);
  });

  it("rejects an empty or too-long title", () => {
    expect(goalCreateSchema.safeParse({ title: "" }).success).toBe(false);
    expect(goalCreateSchema.safeParse({ title: "a".repeat(201) }).success).toBe(
      false,
    );
    expect(goalCreateSchema.safeParse({ title: "a".repeat(200) }).success).toBe(
      true,
    );
  });

  it("rejects description over 2000 and target_outcome over 500", () => {
    expect(
      goalCreateSchema.safeParse({
        title: "x",
        description: "a".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      goalCreateSchema.safeParse({
        title: "x",
        target_outcome: "a".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("rejects hours_per_week outside 1..80 or non-integers", () => {
    expect(
      goalCreateSchema.safeParse({ title: "x", hours_per_week: 0 }).success,
    ).toBe(false);
    expect(
      goalCreateSchema.safeParse({ title: "x", hours_per_week: 81 }).success,
    ).toBe(false);
    expect(
      goalCreateSchema.safeParse({ title: "x", hours_per_week: 2.5 }).success,
    ).toBe(false);
    expect(
      goalCreateSchema.safeParse({ title: "x", hours_per_week: 80 }).success,
    ).toBe(true);
  });

  it("rejects an invalid deadline", () => {
    expect(
      goalCreateSchema.safeParse({ title: "x", deadline: "not-a-date" })
        .success,
    ).toBe(false);
  });
});

describe("goalUpdateSchema", () => {
  it("accepts a partial update", () => {
    expect(goalUpdateSchema.safeParse({ title: "New title" }).success).toBe(
      true,
    );
  });

  it("accepts null to clear optional fields", () => {
    expect(
      goalUpdateSchema.safeParse({
        description: null,
        deadline: null,
        hours_per_week: null,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys, including learner_id and status", () => {
    expect(
      goalUpdateSchema.safeParse({ title: "x", learner_id: "y" }).success,
    ).toBe(false);
    expect(
      goalUpdateSchema.safeParse({ title: "x", status: "active" }).success,
    ).toBe(false);
  });
});

describe("goalStatusChangeSchema", () => {
  it("accepts every valid status", () => {
    for (const status of ["active", "paused", "archived", "completed"]) {
      expect(goalStatusChangeSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects invalid statuses", () => {
    expect(goalStatusChangeSchema.safeParse({ status: "deleted" }).success).toBe(
      false,
    );
    expect(goalStatusChangeSchema.safeParse({ status: "ACTIVE" }).success).toBe(
      false,
    );
    expect(goalStatusChangeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown keys, including learner_id", () => {
    expect(
      goalStatusChangeSchema.safeParse({
        status: "active",
        learner_id: "someone-else",
      }).success,
    ).toBe(false);
  });
});

describe("isValidTimeZone", () => {
  it("accepts real IANA timezones", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
  });

  it("rejects empty and unknown timezones", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Nowhere/Zone")).toBe(false);
    expect(isValidTimeZone("garbage")).toBe(false);
  });
});

describe("diagnosticAnswerSchema", () => {
  const valid = {
    runId: "00000000-0000-4000-8000-000000000000",
    itemId: "exercise-shared-responsibility-mcq",
    response: "you",
  };

  it("accepts the minimal answer body (run + item + raw response)", () => {
    expect(diagnosticAnswerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects server-only keys (correct, capability, accepted, learner)", () => {
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, correct: true }).success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({
        ...valid,
        capability_id: "cloud-shared-responsibility",
      }).success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, accepted: ["you"] })
        .success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, learner_id: "someone-else" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-uuid runId and a non-slug itemId", () => {
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, runId: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, itemId: "Not A Slug" })
        .success,
    ).toBe(false);
    expect(diagnosticAnswerSchema.safeParse({ ...valid, itemId: "" }).success).toBe(
      false,
    );
  });

  it("rejects an empty response and one longer than 500 characters", () => {
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, response: "" }).success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, response: "a".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      diagnosticAnswerSchema.safeParse({ ...valid, response: "a".repeat(500) })
        .success,
    ).toBe(true);
  });
});

describe("diagnosticOptOutSchema", () => {
  it("accepts a bare run reference", () => {
    expect(
      diagnosticOptOutSchema.safeParse({
        runId: "00000000-0000-4000-8000-000000000000",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys, a malformed run id, and missing fields", () => {
    expect(
      diagnosticOptOutSchema.safeParse({
        runId: "00000000-0000-4000-8000-000000000000",
        learner_id: "someone-else",
      }).success,
    ).toBe(false);
    expect(diagnosticOptOutSchema.safeParse({ runId: "nope" }).success).toBe(
      false,
    );
    expect(diagnosticOptOutSchema.safeParse({}).success).toBe(false);
  });
});