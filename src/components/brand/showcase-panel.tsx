import type { Showcase } from "@content/showcase";

/**
 * The hero showcase panel.
 *
 * Renders REAL engine output produced by `buildShowcase()` (see
 * `content/showcase.ts`). It deliberately shows an unflattering result — two
 * capabilities back in practice, two named misunderstandings, nothing mastered —
 * because a demo where everything passes proves nothing.
 *
 * Static Server Component: no client JavaScript, no state, no animation.
 */

function LevelMark({ level }: { level: Showcase["capabilities"][number]["level"] }) {
  // Two states only in the example. The mapping is presentational; the level
  // itself is decided by the engine, never here.
  const demonstrated = level === "demonstrated";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-block size-2 shrink-0 rounded-full ${
          demonstrated ? "bg-accent" : "border border-border-strong bg-transparent"
        }`}
      />
      <span
        className={`font-mono text-[0.6875rem] uppercase tracking-[0.14em] ${
          demonstrated ? "text-accent" : "text-muted"
        }`}
      >
        {demonstrated ? "Demonstrated" : "In practice"}
      </span>
    </span>
  );
}

export function ShowcasePanel({ showcase }: { showcase: Showcase }) {
  return (
    // Deliberately frameless: no border, no fill, no rounded box. The content
    // is separated by hairlines alone, which reads as editorial rather than
    // as a card sitting on a grid.
    <div className="max-w-2xl">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <p className="eyebrow">Diagnostic result</p>
        <p className="font-mono text-[0.6875rem] text-muted tabular">
          5 answers
        </p>
      </div>

      <div className="border-b border-border py-5">
        <p className="text-[0.8125rem] text-muted">Goal</p>
        <p className="mt-1 font-serif text-2xl leading-snug">
          {showcase.goal}
        </p>
      </div>

      <ul>
        {showcase.capabilities.map((capability) => (
          <li key={capability.capabilityId} className="border-b border-border py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <span className="text-sm font-medium">{capability.title}</span>
              <LevelMark level={capability.level} />
            </div>
            {/* The engine's own words, verbatim. */}
            <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-6 text-muted">
              {capability.reason}
            </p>
          </li>
        ))}
      </ul>

      {showcase.misconceptions.length > 0 ? (
        <div className="border-b border-border py-5">
          <p className="eyebrow">What the answers revealed</p>
          <ul className="mt-4 flex flex-col gap-5">
            {showcase.misconceptions.map((misconception) => (
              <li key={misconception.id}>
                <p className="max-w-xl text-[0.8125rem] leading-6">
                  {misconception.description}
                </p>
                <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-6 text-muted">
                  {misconception.remediation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="py-4 text-xs text-muted">
        Produced by the real mastery engine from the reviewed competency map.
        Nothing here is hand-written.
      </p>
    </div>
  );
}