import { describe, expect, it } from "vitest";
import {
  DEFAULT_MASTERY_POLICY,
  MASTERY_STATES,
  evaluateMastery,
  isMasteryState,
  type MasteryAttempt,
  type MasteryEvidence,
} from "@/core/mastery";

/**
 * Mastery engine tests (pure).
 *
 * These assert the PRODUCT rule, not just code behaviour: help must not count
 * as proof, one lucky answer must not equal mastery, and forgetting must send
 * a demonstrated skill back for practice rather than erase it.
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function attempt(overrides: Partial<MasteryAttempt> = {}): MasteryAttempt {
  return {
    itemId: "item-1",
    correct: true,
    mode: "independent",
    hintsUsed: 0,
    submittedAt: daysAgo(1),
    ...overrides,
  };
}

function evidence(
  attempts: MasteryAttempt[],
  introducedAt: Date | null = null,
): MasteryEvidence {
  return { introducedAt, attempts };
}

describe("evaluateMastery — no evidence", () => {
  it("reports untested (not weak) when nothing has been assessed", () => {
    const result = evaluateMastery(evidence([]), NOW);
    expect(result.level).toBe("untested");
    expect(result.reason).toMatch(/unknown, not a gap/i);
  });

  it("reports introduced when taught but never attempted", () => {
    const result = evaluateMastery(evidence([], daysAgo(2)), NOW);
    expect(result.level).toBe("introduced");
  });
});

describe("evaluateMastery — assistance is not proof", () => {
  it("keeps a hint-assisted pass at practising, never demonstrated", () => {
    const result = evaluateMastery(
      evidence([attempt({ hintsUsed: 2 })]),
      NOW,
    );
    expect(result.level).toBe("practising");
    expect(result.assisted).toBe(true);
    expect(result.reason).toMatch(/not yet proof/i);
  });

  it("keeps a guided-mode pass at practising", () => {
    const result = evaluateMastery(
      evidence([attempt({ mode: "guided" })]),
      NOW,
    );
    expect(result.level).toBe("practising");
  });

  it("does not count an assisted pass toward the independent total", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", hintsUsed: 1 }),
        attempt({ itemId: "b", hintsUsed: 1 }),
      ]),
      NOW,
    );
    expect(result.independentPasses).toBe(0);
    expect(result.distinctItems).toBe(0);
    expect(result.level).toBe("practising");
  });
});

describe("evaluateMastery — demonstration requires independence", () => {
  it("reaches demonstrated after one independent pass", () => {
    const result = evaluateMastery(evidence([attempt()]), NOW);
    expect(result.level).toBe("demonstrated");
    expect(result.independentPasses).toBe(1);
    expect(result.distinctItems).toBe(1);
  });

  it("does NOT reach mastered from repeated passes on a single item", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "same", submittedAt: daysAgo(3) }),
        attempt({ itemId: "same", submittedAt: daysAgo(1) }),
      ]),
      NOW,
    );
    expect(result.distinctItems).toBe(1);
    expect(result.level).toBe("demonstrated");
  });

  it("reaches mastered from independent passes across two distinct items", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(5) }),
        attempt({ itemId: "b", submittedAt: daysAgo(1) }),
      ]),
      NOW,
    );
    expect(result.distinctItems).toBe(2);
    expect(result.level).toBe("mastered");
    expect(result.reason).toMatch(/more than once, across different items/i);
  });

  it("honours a stricter policy override", () => {
    const strict = { masterPasses: 3, masterDistinctItems: 3 };
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(5) }),
        attempt({ itemId: "b", submittedAt: daysAgo(2) }),
      ]),
      NOW,
      strict,
    );
    expect(result.level).toBe("demonstrated");
  });
});

describe("evaluateMastery — forgetting is honest, not punitive", () => {
  it("decays a demonstrated skill to revision-needed once it goes stale", () => {
    const result = evaluateMastery(
      evidence([attempt({ submittedAt: daysAgo(20) })]),
      NOW,
    );
    expect(result.level).toBe("revision-needed");
  });

  it("decays a mastered skill to revision-needed as well", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(40) }),
        attempt({ itemId: "b", submittedAt: daysAgo(30) }),
      ]),
      NOW,
    );
    expect(result.level).toBe("revision-needed");
    // The evidence is not thrown away — the receipts still show.
    expect(result.independentPasses).toBe(2);
    expect(result.distinctItems).toBe(2);
  });

  it("does not decay inside the review window", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(10) }),
        attempt({ itemId: "b", submittedAt: daysAgo(10) }),
      ]),
      NOW,
    );
    expect(result.level).toBe("mastered");
  });
});

describe("evaluateMastery — a recent failure reopens the skill", () => {
  it("drops back to practising when the latest attempt was wrong", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(10) }),
        attempt({ itemId: "b", submittedAt: daysAgo(9) }),
        attempt({ itemId: "c", correct: false, submittedAt: daysAgo(1) }),
      ]),
      NOW,
    );
    expect(result.level).toBe("practising");
    expect(result.reason).toMatch(/got it wrong most recently/i);
    // The RESET: passes that predate the wrong answer no longer justify the
    // current state. The full history is still in the evidence ledger — these
    // receipts only answer "what proves where you are now?".
    expect(result.independentPasses).toBe(0);
    expect(result.demonstratedAt).toBeNull();
  });

  it("recovers to demonstrated once it is right again unassisted", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(10) }),
        attempt({ itemId: "c", correct: false, submittedAt: daysAgo(2) }),
        attempt({ itemId: "d", submittedAt: daysAgo(1) }),
      ]),
      NOW,
    );
    expect(result.level).toBe("demonstrated");
  });
});

describe("evaluateMastery — the ceiling cannot be exceeded", () => {
  it("caps the diagnostic at demonstrated, never mastered", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(5) }),
        attempt({ itemId: "b", submittedAt: daysAgo(1) }),
      ]),
      NOW,
      { ceiling: "demonstrated" },
    );
    expect(result.level).toBe("demonstrated");
  });

  it("leaves lower states untouched when a ceiling applies", () => {
    const result = evaluateMastery(
      evidence([attempt({ correct: false, submittedAt: daysAgo(1) })]),
      NOW,
      { ceiling: "demonstrated" },
    );
    expect(result.level).toBe("practising");
  });

  // D4 regression: the ceiling limits PROMOTION, it must not erase decay.
  it("still reports revision-needed for stale evidence under the ceiling", () => {
    const stale = evidence([
      attempt({ itemId: "a", submittedAt: daysAgo(40) }),
      attempt({ itemId: "b", submittedAt: daysAgo(30) }),
    ]);

    // Without a ceiling this evidence would be `mastered`, now lapsed.
    expect(evaluateMastery(stale, NOW).level).toBe("revision-needed");

    // Under the diagnostic ceiling it must stay `revision-needed`.
    // Regression: it used to collapse to `demonstrated`, presenting a skill
    // last demonstrated 30+ days ago as freshly proven.
    const capped = evaluateMastery(stale, NOW, { ceiling: "demonstrated" });
    expect(capped.level).toBe("revision-needed");
    expect(capped.level).not.toBe("demonstrated");
    expect(capped.level).not.toBe("mastered");
    // The decay signal survives, and the exemption never upgrades to mastery.
    expect(capped.demonstratedAt).not.toBeNull();
  });

  it("still blocks a fresh mastered result under the ceiling", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "a", submittedAt: daysAgo(3) }),
        attempt({ itemId: "b", submittedAt: daysAgo(1) }),
      ]),
      NOW,
      { ceiling: "demonstrated" },
    );
    expect(result.level).toBe("demonstrated");
  });
});

describe("evaluateMastery — colliding timestamps", () => {
  // D5 regression: `created_at` defaults to `now()`, which is
  // transaction-scoped in PostgreSQL, so two responses can share a timestamp.
  // Raw timestamp comparison silently discarded the correct answer that
  // followed a tied wrong one. Ordering must fall back to input position.

  it("wrong then correct, same timestamp → the correct answer counts", () => {
    const sameInstant = daysAgo(2);
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "w", correct: false, submittedAt: sameInstant }),
        attempt({ itemId: "c", submittedAt: sameInstant }),
      ]),
      NOW,
    );
    expect(result.independentPasses).toBe(1);
    expect(result.level).toBe("demonstrated");
  });

  it("correct then wrong, same timestamp → the pass is reset", () => {
    const sameInstant = daysAgo(2);
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "c", submittedAt: sameInstant }),
        attempt({ itemId: "w", correct: false, submittedAt: sameInstant }),
      ]),
      NOW,
    );
    expect(result.independentPasses).toBe(0);
    expect(result.level).toBe("practising");
  });

  it("is deterministic given the same input sequence", () => {
    const sameInstant = daysAgo(2);
    const seq = [
      attempt({ itemId: "w", correct: false, submittedAt: sameInstant }),
      attempt({ itemId: "c", submittedAt: sameInstant }),
    ];
    expect(evaluateMastery(evidence(seq), NOW)).toEqual(
      evaluateMastery(evidence(seq), NOW),
    );
  });

  it("orders by timestamp when timestamps genuinely differ", () => {
    const result = evaluateMastery(
      evidence([
        attempt({ itemId: "w", correct: false, submittedAt: daysAgo(10) }),
        attempt({ itemId: "c", submittedAt: daysAgo(1) }),
      ]),
      NOW,
    );
    expect(result.independentPasses).toBe(1);
    expect(result.level).toBe("demonstrated");
  });

  it("does not mutate or reorder the caller's array", () => {
    const sameInstant = daysAgo(2);
    const seq = [
      attempt({ itemId: "late", submittedAt: sameInstant }),
      attempt({ itemId: "early", correct: false, submittedAt: daysAgo(9) }),
    ];
    const firstId = seq[0].itemId;
    evaluateMastery(evidence(seq), NOW);
    expect(seq[0].itemId).toBe(firstId);
    expect(seq).toHaveLength(2);
  });
});

describe("mastery state contract", () => {
  it("is a closed set with no duplicates", () => {
    expect(new Set(MASTERY_STATES).size).toBe(MASTERY_STATES.length);
  });

  it("validates known states and rejects unknown ones", () => {
    expect(isMasteryState("mastered")).toBe(true);
    expect(isMasteryState("expert")).toBe(false);
  });

  it("ships a coherent default policy", () => {
    expect(DEFAULT_MASTERY_POLICY.masterPasses).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_MASTERY_POLICY.masterDistinctItems).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_MASTERY_POLICY.reviewAfterDays).toBeGreaterThan(0);
  });
});

describe("evaluateMastery — purity", () => {
  it("returns the same answer for the same evidence and time", () => {
    const ev = evidence([attempt({ itemId: "a", submittedAt: daysAgo(4) })]);
    expect(evaluateMastery(ev, NOW)).toEqual(evaluateMastery(ev, NOW));
  });

  it("does not mutate the evidence it is given", () => {
    const attempts = [attempt()];
    const snapshot = JSON.stringify(attempts);
    evaluateMastery(evidence(attempts), NOW);
    expect(JSON.stringify(attempts)).toBe(snapshot);
  });
});