import { describe, expect, it } from "vitest";
import {
  GOAL_TRANSITIONS,
  canTransition,
  type GoalStatus,
} from "@/lib/goals/transitions";

const ALL: GoalStatus[] = ["active", "paused", "archived", "completed"];

const ALLOWED_PAIRS: readonly (readonly [GoalStatus, GoalStatus])[] = [
  ["active", "paused"],
  ["active", "archived"],
  ["active", "completed"],
  ["paused", "active"],
  ["paused", "archived"],
];

describe("goal status transitions", () => {
  it("allows exactly the documented pairs and nothing else", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const expected = ALLOWED_PAIRS.some(
          ([f, t]) => f === from && t === to,
        );
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("treats archived and completed as terminal", () => {
    expect(GOAL_TRANSITIONS.archived).toHaveLength(0);
    expect(GOAL_TRANSITIONS.completed).toHaveLength(0);
  });

  it("forbids self transitions", () => {
    for (const status of ALL) {
      expect(canTransition(status, status), `${status} -> ${status}`).toBe(
        false,
      );
    }
  });
});