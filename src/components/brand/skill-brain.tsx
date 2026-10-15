/**
 * The skill brain.
 *
 * Every node is a REAL capability from the reviewed competency map, and every
 * node's state comes from the REAL mastery engine — a node glows because
 * `evaluateMastery` returned `demonstrated` for that skill. Nothing here is
 * decorative motion pretending to be progress.
 *
 * The reveal walks the prerequisite DAG in topological order, so the animation
 * *is* the dependency chain: the root unlocks, then the two branches it unlocks,
 * then what those two unlock together.
 *
 * Pure Server Component. Static SVG + CSS with staggered `animation-delay`s —
 * no "use client", no observer, no canvas, no three.js, zero client JavaScript.
 */

export type BrainState = "unlocked" | "active" | "locked";

export interface BrainNode {
  id: string;
  label: string;
  state: BrainState;
  /** Depth in the prerequisite DAG; drives the reveal stagger. */
  depth: number;
  x: number;
  y: number;
}

export interface BrainEdge {
  from: string;
  to: string;
}

const STATE_COLOR: Record<BrainState, string> = {
  unlocked: "var(--accent)",
  active: "var(--foreground)",
  locked: "var(--network-line)",
};

/** Folds of each hemisphere — the detail that makes it read as a brain. */
const GYRI: readonly string[] = [
  "M120 62 C 99 68 76 62 60 76",
  "M120 100 C 97 110 72 104 56 120",
  "M120 138 C 101 148 82 143 68 157",
  "M120 62 C 141 68 164 62 180 76",
  "M120 100 C 143 110 168 104 184 120",
  "M120 138 C 139 148 158 143 172 157",
];

export function SkillBrain({
  nodes,
  edges,
}: {
  nodes: BrainNode[];
  edges: BrainEdge[];
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const unlockedCount = nodes.filter((n) => n.state === "unlocked").length;

  return (
    <div className="brain">
      <svg
        viewBox="0 0 240 200"
        className="w-full"
        role="img"
        aria-label={`Skill map: ${unlockedCount} of ${nodes.length} skills demonstrated`}
      >
        {/* Cranial outline, top-down. Undulating contour + a central fissure. */}
        <g
          stroke="var(--network-line)"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M120 16 C 140 9 165 18 177 33 C 197 39 211 57 208 77 C 219 93 214 113 202 127 C 200 147 186 165 168 173 C 154 187 136 193 120 193 C 104 193 86 187 72 173 C 54 165 40 147 38 127 C 26 113 21 93 32 77 C 29 57 43 39 63 33 C 75 18 100 9 120 16 Z" />
          <path
            d="M120 16 C 117 58 123 102 120 146 C 119 166 120 182 120 193"
            opacity="0.55"
          />
          {GYRI.map((d) => (
            <path key={d} d={d} opacity="0.3" />
          ))}
        </g>

        {/* Prerequisite edges, drawn in topological order. */}
        <g aria-hidden="true">
          {edges.map((edge, index) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const lit = from.state === "unlocked" && to.state !== "locked";
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                className="brain-edge"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={lit ? "var(--accent)" : "var(--network-line)"}
                strokeWidth={lit ? 1.75 : 1.25}
                strokeLinecap="round"
                opacity={lit ? 0.7 : 0.35}
                style={{ animationDelay: `${index * 90}ms` }}
              />
            );
          })}
        </g>

        {/* Skill nodes. */}
        <g>
          {nodes.map((node) => {
            const unlocked = node.state === "unlocked";
            const color = STATE_COLOR[node.state];
            return (
              <g
                key={node.id}
                className="brain-node"
                style={{ animationDelay: `${120 + node.depth * 220}ms` }}
              >
                {unlocked || node.state === "active" ? (
                  <circle
                    className="brain-halo"
                    cx={node.x}
                    cy={node.y}
                    r={15}
                    fill={color}
                    style={{ animationDelay: `${520 + node.depth * 220}ms` }}
                  />
                ) : null}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={unlocked ? 9 : 7.5}
                  fill={unlocked ? color : "var(--background)"}
                  stroke={color}
                  strokeWidth={unlocked ? 0 : 2}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend — hairline separated, no boxes, no square swatches. */}
      <ul className="mt-8">
        {nodes.map((node) => (
          <li
            key={node.id}
            className="flex items-center justify-between gap-4 border-t border-border py-2.5"
          >
            <span className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{
                  // Mirrors the SVG exactly: demonstrated is filled, in
                  // practice is outlined, locked is outlined and dim. An
                  // earlier version filled "in practice" here while the
                  // diagram outlined it — the legend contradicted the picture.
                  background:
                    node.state === "unlocked"
                      ? "var(--accent)"
                      : "transparent",
                  border:
                    node.state === "locked"
                      ? "1.5px solid var(--network-line)"
                      : "2px solid var(--foreground)",
                  boxShadow:
                    node.state === "unlocked"
                      ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)"
                      : undefined,
                }}
              />
              <span className={node.state === "locked" ? "text-muted" : ""}>
                {node.label}
              </span>
            </span>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
              {node.state === "unlocked"
                ? "Demonstrated"
                : node.state === "active"
                  ? "In practice"
                  : "Locked"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}