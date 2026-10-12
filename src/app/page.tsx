import type { Metadata } from "next";
import { BrainVisual } from "@/components/brain/brain-visual";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
    type: "website",
    siteName: siteConfig.name,
  },
};

const STEPS = [
  {
    title: "Set a goal",
    body: "Describe what you want to be able to do — not which course to finish.",
  },
  {
    title: "Learn and prove it",
    body: "Short lessons, then checks that ask you to demonstrate the skill.",
  },
  {
    title: "Rismon remembers",
    body: "What you proved, and what you got wrong, shapes what comes next.",
  },
] as const;

const DIFFERENCES = [
  {
    title: "Evidence, not progress",
    body: "A progress bar fills whether or not you understood anything. Rismon is built so a topic only counts once you can prove it.",
  },
  {
    title: "It remembers your misconceptions",
    body: "A wrong answer is more than a red cross. Rismon is built to record the specific misunderstanding behind it so it can resurface later.",
  },
  {
    title: "It explains its next step",
    body: "No black box. Rismon is designed to tell you what it plans to practise next and why.",
  },
  {
    title: "You own your data",
    body: "Your goals and profile live in your account. No advertising trackers, no selling data — see the privacy page for exactly what is stored.",
  },
] as const;

const FAQ = [
  {
    q: "Is Rismon finished?",
    a: "No. Rismon is an early private beta. The home page describes the design; some pieces of the experience are still being built.",
  },
  {
    q: "What can I learn with it?",
    a: "The first subject — networking fundamentals — is being built now. More subjects are planned for later.",
  },
  {
    q: "Does AI grade my answers?",
    a: "Not yet. Today, deterministic code owns answers and mastery. When AI features arrive they will only propose; validated code decides — AI never sets mastery.",
  },
  {
    q: "How do I get access?",
    a: "Rismon is in private beta. Request access and you will hear from us when a spot opens.",
  },
  {
    q: "What do you store about me?",
    a: "Your account, your goals and your profile settings. The details are on the privacy page.",
  },
] as const;

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-10">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        {label}
      </p>
      <h2 className="mt-3 text-3xl font-semibold">{title}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <main id="main" className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-grid">
        <div className="bg-radial-glow absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
          <div>
            <Badge variant="accent">Private beta</Badge>
            <h1 className="mt-5 text-4xl font-semibold md:text-5xl">
              {siteConfig.tagline}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Rismon turns your goal into a learning path, tests what you can
              prove, and decides what to learn next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/beta">Request beta access</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
          </div>
          <div className="h-[320px] md:h-[420px]">
            <BrainVisual />
          </div>
        </Container>
      </section>

      {/* How it works */}
      <Section id="how-it-works">
        <Container>
          <SectionHeading label="How it works" title="From goal to proof" />
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <span className="font-mono text-xs text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* What makes it different */}
      <Section id="different" className="border-t border-border">
        <Container>
          <SectionHeading
            label="What makes it different"
            title="Built around proof, not streaks"
          />
          <div className="grid gap-8 md:grid-cols-2">
            {DIFFERENCES.map((item) => (
              <div key={item.title}>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Free during the private beta */}
      <Section id="beta-free" className="border-t border-border">
        <Container>
          <div className="rounded-lg border border-border bg-surface p-8 md:p-10">
            <h2 className="text-2xl font-semibold">
              Free during the private beta
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Rismon is free while it is in private beta. If pricing ever
              arrives, beta testers will hear about it first — nobody will be
              charged without warning.
            </p>
            <div className="mt-6">
              <ButtonLink href="/beta">Request beta access</ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="border-t border-border">
        <Container>
          <SectionHeading label="FAQ" title="Questions, answered honestly" />
          <dl className="grid gap-8 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm leading-6 text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
    </main>
  );
}

