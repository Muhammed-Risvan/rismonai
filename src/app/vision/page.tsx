import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Vision",
  description:
    "Why Rismon exists: proof over progress, honest feedback, data that stays yours, and AI that never decides mastery.",
  openGraph: {
    title: "Vision — Rismon",
    description:
      "Why Rismon exists: proof over progress, honest feedback, data that stays yours, and AI that never decides mastery.",
    url: "/vision",
    type: "website",
    siteName: siteConfig.name,
  },
};

const PRINCIPLES = [
  {
    title: "Proof over progress",
    body: "Course completion and streak counters measure time spent, not skill. Rismon counts a topic as learned only when you have demonstrated it.",
  },
  {
    title: "Honest feedback",
    body: "If an answer is wrong, Rismon says so plainly and points at the gap instead of padding a score to feel encouraging.",
  },
  {
    title: "Your data is yours",
    body: "Your account holds your goals and profile. No advertising, no trackers. What is stored today is described exactly on the privacy page.",
  },
  {
    title: "AI assists, but never decides mastery",
    body: "AI may eventually suggest explanations or practice, but deterministic, tested code validates every answer and owns mastery state. AI output can never set it.",
  },
] as const;

export default function VisionPage() {
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <Badge variant="accent">Private beta</Badge>
          <h1 className="mt-5 text-4xl font-semibold">Why Rismon exists</h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted">
            <p>
              Most learning tools optimise for feeling productive: videos
              watched, lessons finished, days in a row. None of that proves you
              can actually do the thing you sat down to learn.
            </p>
            <p>
              Rismon starts from the opposite end. You state a goal in terms of
              what you want to be able to do, follow a path built from that
              goal, and are asked to prove each step. What you can prove — and
              specifically where you were wrong — is what the system remembers.
            </p>
            <p>
              It is deliberately small and honest right now: an early private
              beta, with the first subject being built by hand.
            </p>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-border">
        <Container>
          <h2 className="text-3xl font-semibold">Principles</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <h3 className="text-lg font-semibold">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {principle.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-t border-border">
        <Container size="narrow">
          <h2 className="text-3xl font-semibold">Where we are</h2>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted">
            <p>
              Rismon is in <strong className="text-foreground">early private
              beta</strong>. Accounts, goals and a dashboard exist; the learning
              engine behind them is being built.
            </p>
            <p>
              The first subject is <strong className="text-foreground">
              networking fundamentals</strong> — written and structured by hand
              so the proofs are real. AI features are not live yet, and when
              they arrive they will assist rather than decide.
            </p>
            <p>
              Want to help shape it?{" "}
              <a
                href="/beta"
                className="text-accent underline-offset-4 hover:underline"
              >
                Request beta access
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
