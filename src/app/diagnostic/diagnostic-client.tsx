"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError, FormStatus, INPUT_CLASS } from "@/components/ui/form";
import type { AmbitionDto } from "@/server/http/dto";
import type { DiagnosticState } from "@/server/services/diagnostic";

/**
 * Baseline-diagnostic runner.
 *
 * This client is a VIEW: it never decides correctness, progress or level. It
 * posts the learner's raw answer and renders exactly what the engine returns.
 * The two rules it must not break:
 * - it never computes or infers a level locally;
 * - it never shows a level the server did not send.
 *
 * Honest labelling is deliberate: `untested` is shown as "not shown to have
 * this yet" rather than "weak", because an untested skill is not a gap.
 */

/**
 * Honest labelling. `untested` is deliberately NOT shown as a weakness: a
 * skill nobody has been asked about is unknown, not a gap. `practising` is
 * shown as progress, because it is — just not proof.
 */
const LEVEL_COPY: Record<string, { label: string; blurb: string }> = {
  unknown: {
    label: "Not assessed",
    blurb: "You chose not to answer, so this is genuinely unknown — not a gap.",
  },
  untested: {
    label: "Not assessed yet",
    blurb: "There is no evidence either way yet. This is not a weakness.",
  },
  introduced: {
    label: "Shown to you",
    blurb: "You have been taught this but have not tried it yet.",
  },
  practising: {
    label: "Practising",
    blurb: "You have tried this, but not yet got it right on your own.",
  },
  demonstrated: {
    label: "Demonstrated",
    blurb: "You answered this correctly, without help.",
  },
  mastered: {
    label: "Reliably demonstrated",
    blurb: "You have shown this independently, more than once, across items.",
  },
  "revision-needed": {
    label: "Needs revision",
    blurb: "You showed this before and it is due a refresh.",
  },
};

function levelCopy(level: string) {
  return (
    LEVEL_COPY[level] ?? { label: level, blurb: "" }
  );
}

export function DiagnosticClient({
  initialState,
  ambitions,
}: {
  initialState: DiagnosticState;
  ambitions: AmbitionDto[];
}) {
  const router = useRouter();
  const [state, setState] = useState<DiagnosticState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Feedback for the question just answered. Held here (not in the question
   * component) so it survives the state refresh that loads the NEXT question:
   * the learner reads why they were wrong before moving on, instead of the
   * explanation disappearing the instant it appears.
   */
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/diagnostic");
    if (!response.ok) {
      setError("Could not load your diagnostic. Please try again.");
      return;
    }
    setState((await response.json()) as DiagnosticState);
  }, []);

  async function post(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError("Something went wrong. Please try again.");
        return null;
      }
      return (await response.json()) as unknown;
    } catch {
      setError("Network problem. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <h1 className="text-3xl font-semibold">Starting point</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        This is a short set of questions to find out what you already know
        before any lessons are chosen. It is not a grade, and there are no
        wrong answers — they are information.
      </p>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FormError message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        {state.status === "no-goal" ? (
          <Section>
            <h2 className="text-xl font-semibold">No journey yet</h2>
            <p className="mt-2 text-sm text-muted">
              Choose what you are working towards first, then we can find out
              where you are starting from.
            </p>
            <div className="mt-4">
              <ButtonLink href="/onboarding">Set your goal</ButtonLink>
            </div>
          </Section>
        ) : null}

        {state.status === "no-ambition" ? (
          <Section>
            <h2 className="text-xl font-semibold">
              This journey is not linked to a subject
            </h2>
            <p className="mt-2 text-sm text-muted">
              A goal needs a subject before we can assess you. Pick the one
              you are pursuing.
            </p>
            <AmbitionPicker goalId={state.goalId} ambitions={ambitions} />
          </Section>
        ) : null}

        {state.status === "not_started" ? (
          <Section>
            <h2 className="text-xl font-semibold">Ready when you are</h2>
            <p className="mt-2 text-sm text-muted">
              Around a dozen short questions, one at a time. You can stop and
              come back, and you can skip it entirely.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await post({ type: "start" })) {
                    await refresh();
                  }
                }}
              >
                {busy ? "Starting…" : "Start the diagnostic"}
              </Button>
            </div>
          </Section>
        ) : null}

        {state.status === "in_progress" ? (
          <InProgress
            state={state}
            busy={busy}
            feedback={feedback}
            onSubmit={async (itemId, response) => {
              const result = (await post({
                type: "submit",
                runId: state.run.id,
                itemId,
                response,
              })) as SubmitResult | null;
              if (result) {
                setFeedback(result);
              }
              return result;
            }}
            onContinue={async () => {
              setFeedback(null);
              await refresh();
            }}
            onOptOut={async () => {
              if (await post({ type: "optOut", runId: state.run.id })) {
                setFeedback(null);
                await refresh();
              }
            }}
          />
        ) : null}

        {state.status === "complete" || state.status === "opted_out" ? (
          <Finished
            state={state}
            busy={busy}
            onReassess={async () => {
              if (await post({ type: "reassess" })) {
                await refresh();
                router.refresh();
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      {children}
    </div>
  );
}

function AmbitionPicker({
  goalId,
  ambitions,
}: {
  goalId: string;
  ambitions: AmbitionDto[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(ambitions[0]?.id ?? "");

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/goals/${goalId}/ambition`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ambitionId: selected }),
      });
      if (!response.ok) {
        setError("Could not link that subject. Please try again.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (ambitions.length === 0) {
    return (
      <div className="mt-4">
        <FormError message="No subjects are available right now." />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Subject
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-base"
        >
          {ambitions.map((ambition) => (
            <option key={ambition.id} value={ambition.id}>
              {ambition.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <FormError message={error} /> : null}
      <div>
        <Button onClick={link} disabled={busy || !selected}>
          {busy ? "Linking…" : "Link and continue"}
        </Button>
      </div>
    </div>
  );
}

type SubmitResult = {
  correct: boolean;
  complete: boolean;
  misconception: { description: string; remediation: string } | null;
};

function InProgress({
  state,
  busy,
  feedback,
  onSubmit,
  onContinue,
  onOptOut,
}: {
  state: Extract<DiagnosticState, { status: "in_progress" }>;
  busy: boolean;
  feedback: SubmitResult | null;
  onSubmit: (itemId: string, response: string) => Promise<SubmitResult | null>;
  onContinue: () => Promise<void>;
  onOptOut: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const item = state.nextItem;

  if (!item) {
    return (
      <Section>
        <h2 className="text-xl font-semibold">Finishing up…</h2>
        <p className="mt-2 text-sm text-muted">
          Your answers are saved. Loading your results.
        </p>
      </Section>
    );
  }

  const progress = Math.round((state.answered / state.total) * 100);

  return (
    <Section>
      <div className="flex items-center justify-between">
        <Badge variant="accent">
          Question {state.answered + 1} of {state.total}
        </Badge>
        <span aria-live="polite" className="text-xs text-muted">
          {progress}% answered
        </span>
      </div>

      <p className="mt-4 text-lg leading-7">{item.prompt}</p>

      {feedback ? (
        <div className="mt-4 flex flex-col gap-3">
          <FormStatus
            message={
              feedback.correct
                ? "Correct."
                : feedback.misconception
                  ? "Not quite — and we can tell why."
                  : "Not correct. This skill has not been taught yet."
            }
          />
          {feedback.misconception ? (
            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-sm font-medium">
                What that answer suggests
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {feedback.misconception.description}
              </p>
              <p className="mt-3 text-sm leading-6">
                {feedback.misconception.remediation}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              We have not identified a specific reason for this one, so we are
              not going to guess. It simply starts as something to learn.
            </p>
          )}
          <div>
            <Button onClick={() => void onContinue()} disabled={busy}>
              {busy
                ? "Loading…"
                : feedback.complete
                  ? "See my starting point"
                  : "Next question"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!answer.trim()) {
                return;
              }
              await onSubmit(item.itemId, answer);
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Your answer
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={busy}
                autoFocus
                className={INPUT_CLASS}
              />
            </label>
            <div>
              <Button type="submit" disabled={busy || !answer.trim()}>
                {busy ? "Checking…" : "Submit answer"}
              </Button>
            </div>
          </form>

          <button
            type="button"
            onClick={onOptOut}
            disabled={busy}
            className="mt-6 text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Skip the diagnostic — I&apos;d rather start without it
          </button>
        </>
      )}
    </Section>
  );
}

function Finished({
  state,
  busy,
  onReassess,
}: {
  state: Extract<
    DiagnosticState,
    { status: "complete" | "opted_out" }
  >;
  busy: boolean;
  onReassess: () => Promise<void>;
}) {
  const optedOut = state.status === "opted_out";

  return (
    <div className="flex flex-col gap-6">
      <Section>
        <h2 className="text-xl font-semibold">
          {optedOut ? "You skipped it" : "Here is where you are starting"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {optedOut
            ? "Nothing was assessed, so nothing is marked as weak. Everything below is genuinely unknown, and your journey will start from the beginning."
            : "These are starting points, not a score. A single correct answer can show that you know something — but it can never mark you as fully mastered. Only independent answers count, and a mistake sends a skill back to practice."}
        </p>
      </Section>

      <Section>
        <h3 className="font-semibold">By capability</h3>
        <ul className="mt-3 flex flex-col gap-3">
          {state.levels.map((level) => {
            const copy = levelCopy(level.level);
            return (
              <li
                key={level.capabilityId}
                className="rounded-md border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {level.capabilityId.replace(/-/g, " ")}
                  </span>
                  <Badge>{copy.label}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{copy.blurb}</p>
                {level.evidenceCount > 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    Backed by {level.evidenceCount} independent answer
                    {level.evidenceCount === 1 ? "" : "s"}.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    No independent answers yet.
                  </p>
                )}
                {level.reviewAt ? (
                  <p className="mt-1 text-xs text-muted">
                    Next review: {new Date(level.reviewAt).toLocaleDateString()}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      {state.misconceptions.length > 0 ? (
        <Section>
          <h3 className="font-semibold">What we picked up</h3>
          <p className="mt-2 text-sm text-muted">
            These are the specific misunderstandings your answers pointed to.
            They come back when you practise the related skill.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {state.misconceptions.map((misconception) => (
              <li
                key={misconception.misconceptionId}
                className="rounded-md border border-border bg-background p-4"
              >
                <p className="text-sm">{misconception.description}</p>
                <p className="mt-2 text-sm text-muted">
                  {misconception.remediation}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Seen {misconception.timesEncountered} time
                  {misconception.timesEncountered === 1 ? "" : "s"}
                  {misconception.resolvedAt ? " · resolved" : " · open"}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/dashboard" variant="secondary">
          Back to dashboard
        </ButtonLink>
        <Button onClick={onReassess} disabled={busy}>
          {busy ? "Working…" : "Take it again"}
        </Button>
      </div>
    </div>
  );
}