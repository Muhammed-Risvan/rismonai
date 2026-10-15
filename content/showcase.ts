import { evaluateMastery, type MasteryState } from "@/core/mastery";
import { gradeWithMisconception } from "@/core/diagnostic/misconception";
import { DIAGNOSTIC_CEILING } from "@/core/diagnostic/coverage";
import { getAmbitionEntry, getMisconception } from "./index";

/**
 * The homepage showcase — a worked example rendered by the REAL engine.
 *
 * This is not mock data. Every level, every reason string and every
 * misconception shown on the home page is produced by `evaluateMastery` and
 * `gradeWithMisconception` running over the real reviewed competency map in
 * `content/`. If the engine or the content changes, the home page changes with
 * it — which is the entire point: a landing page that describes the product is
 * worth less than one that demonstrates it.
 *
 * It lives in `content/` because it is authored demonstration material, not
 * engine logic. It imports the engine; the engine never imports it.
 */

const AMBITION_ID = "cloud-security-engineer";

/**
 * A fixed reference instant for the example.
 *
 * Deliberately fixed rather than `new Date()`: the home page is statically
 * rendered, and more importantly the scenario must stay internally consistent
 * forever. If attempt times were computed against the real clock, the
 * "demonstrated" capabilities would silently decay to `revision-needed` the
 * moment someone visited the page in 2027. Anchoring both the attempts and
 * `now` to one constant means the example always tells the same, true story.
 */
const SHOWCASE_NOW = new Date("2026-01-15T10:00:00.000Z");

interface Answer {
  /** Item id from the reviewed competency map. */
  itemId: string;
  /** What the learner actually typed. */
  response: string;
  /** Days before the reference instant. */
  daysAgo: number;
}

/**
 * A realistic beginner's first diagnostic: strong on the fundamentals, and
 * wrong in two specific, instructive ways. Chosen because it produces an honest
 * spread — nothing mastered, nothing faked, two named misconceptions.
 */
const LEARNER_ANSWERS: readonly Answer[] = [
  { itemId: "exercise-shared-responsibility-mcq", response: "you", daysAgo: 0 },
  { itemId: "exercise-shared-boundary-check", response: "provider", daysAgo: 0 },
  { itemId: "exercise-identity-allowlist-assessment", response: "read-only", daysAgo: 0 },
  { itemId: "exercise-network-exposure-assessment", response: "public", daysAgo: 0 },
  { itemId: "exercise-detection-signal-assessment", response: "sign-in log", daysAgo: 0 },
];

export interface ShowcaseCapability {
  capabilityId: string;
  title: string;
  level: MasteryState;
  /** The engine's own justification, shown verbatim. */
  reason: string;
  independentPasses: number;
}

export interface ShowcaseMisconception {
  id: string;
  description: string;
  remediation: string;
}

export interface Showcase {
  goal: string;
  ambitionName: string;
  capabilities: ShowcaseCapability[];
  misconceptions: ShowcaseMisconception[];
}

export interface ShowcaseGraphNode {
  id: string;
  label: string;
  /** Real engine state for this capability. */
  state: "unlocked" | "active" | "locked";
  /** Depth in the prerequisite DAG — drives the brain's reveal order. */
  depth: number;
  x: number;
  y: number;
}

export interface ShowcaseGraph {
  nodes: ShowcaseGraphNode[];
  edges: Array<{ from: string; to: string }>;
}

/**
 * The capability graph, wired to real engine output.
 *
 * Positions are a hand-placed layout for the brain silhouette — presentation
 * only. Everything that *means* something (the states, the depth, the edges)
 * is derived from the reviewed content and the mastery engine, so the picture
 * cannot claim a skill is unlocked when the engine says otherwise.
 */
/**
 * Positions inside the top-down brain silhouette (viewBox 240x200): one root
 * at the top, two branches either side, and the convergence at the bottom.
 * Presentation only — states, depth and edges are all derived from content.
 */
const LAYOUT: Readonly<Record<string, { x: number; y: number }>> = {
  "cloud-shared-responsibility": { x: 120, y: 62 },
  "identity-and-access-basics": { x: 74, y: 124 },
  "network-security-basics": { x: 166, y: 128 },
  "logging-and-monitoring": { x: 120, y: 170 },
};

/**
 * The capability graph for the brain: real nodes, real edges, real states.
 * Built once and consumed by the home page.
 */
export function buildShowcaseGraph(): ShowcaseGraph {
  const entry = getAmbitionEntry(AMBITION_ID);
  if (!entry) {
    throw new Error(`Showcase ambition "${AMBITION_ID}" is missing from the catalog`);
  }
  const { capabilities } = entry.competencyMap;

  const stateById = new Map(
    buildShowcase().capabilities.map((c) => [c.capabilityId, c.level]),
  );

  // Depth = longest prerequisite chain, so a skill never unlocks before the
  // skill it actually depends on.
  const depthOf = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) {
      throw new Error(`Cycle in showcase graph at "${id}"`);
    }
    const capability = capabilities.find((c) => c.id === id);
    if (!capability || capability.prerequisites.length === 0) {
      return 0;
    }
    const next = new Set(seen).add(id);
    return (
      1 +
      Math.max(
        ...capability.prerequisites.map((prerequisite) =>
          depthOf(prerequisite, next),
        ),
      )
    );
  };

  const nodes: ShowcaseGraphNode[] = capabilities.map((capability) => {
    const level = stateById.get(capability.id);
    const position = LAYOUT[capability.id];
    if (!position) {
      throw new Error(
        `Showcase layout is missing a position for "${capability.id}"`,
      );
    }
    return {
      id: capability.id,
      label: capability.title,
      state:
        level === undefined
          ? "locked"
          : level === "demonstrated" || level === "mastered"
            ? "unlocked"
            : "active",
      depth: depthOf(capability.id, new Set()),
      x: position.x,
      y: position.y,
    };
  });

  const edges = nodes.flatMap((node) =>
    capabilities
      .find((capability) => capability.id === node.id)!
      .prerequisites.map((from) => ({ from, to: node.id })),
  );

  return { nodes, edges };
}

/**
 * Builds the example by grading the learner's answers against the real answer
 * keys and misconception signatures, then running the real mastery engine with
 * the same `demonstrated` ceiling the diagnostic service uses.
 */
export function buildShowcase(): Showcase {
  const entry = getAmbitionEntry(AMBITION_ID);
  if (!entry) {
    throw new Error(`Showcase ambition "${AMBITION_ID}" is missing from the catalog`);
  }
  const { capabilities, exercises } = entry.competencyMap;
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  // Grade every answer against real content, and note the capability it counts
  // toward. A missing item is a content bug and must fail loudly here rather
  // than silently produce a shorter example.
  const graded = LEARNER_ANSWERS.map((answer, index) => {
    const exercise = byId.get(answer.itemId);
    if (!exercise) {
      throw new Error(`Showcase references unknown exercise "${answer.itemId}"`);
    }
    const result = gradeWithMisconception(answer.response, exercise);
    return {
      ...answer,
      // Position in the run, so attempts carry strictly increasing timestamps
      // exactly as the persisted ledger would.
      index,
      capabilityId: exercise.capabilityIds[0],
      correct: result.correct,
      misconceptionId: result.misconceptionId,
    };
  });

  const shown = capabilities.filter((capability) =>
    graded.some((answer) => answer.capabilityId === capability.id),
  );

  const evaluated: ShowcaseCapability[] = shown.map((capability) => {
    const attempts = graded
      .filter((answer) => answer.capabilityId === capability.id)
      .map((answer) => ({
        itemId: answer.itemId,
        correct: answer.correct,
        mode: "independent" as const,
        hintsUsed: 0,
        submittedAt: new Date(
          SHOWCASE_NOW.getTime() - (LEARNER_ANSWERS.length - answer.index) * 1000,
        ),
      }));

    const decision = evaluateMastery(
      { introducedAt: null, attempts },
      SHOWCASE_NOW,
      { ceiling: DIAGNOSTIC_CEILING },
    );

    return {
      capabilityId: capability.id,
      title: capability.title,
      level: decision.level,
      reason: decision.reason,
      independentPasses: decision.independentPasses,
    };
  });

  // Deduplicate misconceptions: two items can reveal the same one.
  const seen = new Set<string>();
  const misconceptions: ShowcaseMisconception[] = [];
  for (const answer of graded) {
    if (answer.misconceptionId === null || seen.has(answer.misconceptionId)) {
      continue;
    }
    seen.add(answer.misconceptionId);
    const authored = getMisconception(answer.misconceptionId);
    if (!authored) {
      continue;
    }
    misconceptions.push({
      id: authored.id,
      description: authored.description,
      remediation: authored.remediation,
    });
  }

  return {
    goal: "Become a cloud security engineer",
    ambitionName: entry.ambition.name,
    capabilities: evaluated,
    misconceptions,
  };
}