import type { Metadata } from "next";
import { buildShowcase, buildShowcaseGraph } from "@content/showcase";
import { SkillBrain } from "@/components/brand/skill-brain";
import { ShowcasePanel } from "@/components/brand/showcase-panel";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
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
    n: "01",
    title: "Name the job",
    body: "Cloud Security Engineer. Or something else — the journey follows your goal, not a fixed course.",
  },
  {
    n: "02",
    title: "Answer five questions",
    body: "No hints, no grades. This is to find your starting point, not to test you.",
  },
  {
    n: "03",
    title: "Start where you are",
    body: "Skills you already have are marked done. What is left is what gets taught.",
  },
] as const;

const FAQ = [
  {
    q: "Is it finished?",
    a: "No. Sign-up, goals, the diagnostic and a progress view work. Lessons and roadmaps do not exist yet.",
  },
  {
    q: "What can I learn?",
    a: "Cloud Security Engineer, from a beginner start. It is a small reviewed set today, not a complete course.",
  },
  {
    q: "Does AI pick my level?",
    a: "No. Tested, deterministic code grades every answer and owns every level. There is no AI in the path yet.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes, and it cascades — account, goals, answers and history all go. The privacy page lists what is stored.",
  },
];

export default function Home() {
  const showcase = buildShowcase();
  const graph = buildShowcaseGraph();

  const unlocked = graph.nodes.filter(
    (node) => node.state === "unlocked",
  ).length;

  return (
    <main id="main" className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <Container className="relative py-16 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-12 md:gap-12">
            <div className="md:col-span-6">
              <p className="eyebrow">Private beta</p>
              <h1 className="mt-5 text-display font-medium">
                Start where you are.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-8 text-muted">
                Name the job you want. Rismon checks what you already know,
                then teaches only the gap.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/login">Start learning</ButtonLink>
              </div>

              <p className="mt-10 max-w-sm text-sm leading-6 text-muted">
                Five questions. Four skills assessed.{" "}
                <span className="text-foreground">
                  {unlocked} unlocked, none mastered.
                </span>{" "}
                This is a real result from the real engine.
              </p>
            </div>

            <div className="md:col-span-6">
              <SkillBrain nodes={graph.nodes} edges={graph.edges} />
            </div>
          </div>
        </Container>
      </section>

      {/* Three steps */}
      <section id="how-it-works" className="border-b border-border">
        <Container className="py-16 md:py-20">
          <h2 className="sr-only">How it works</h2>
          <ol className="border-t border-border">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid gap-2 border-b border-border py-6 md:grid-cols-12 md:gap-8"
              >
                <span className="font-mono text-xs text-muted tabular md:col-span-1">
                  {step.n}
                </span>
                <h3 className="text-sm font-medium md:col-span-4">
                  {step.title}
                </h3>
                <p className="text-sm leading-6 text-muted md:col-span-7">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* The actual diagnostic output */}
      <section id="example" className="border-b border-border">
        <Container className="py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="eyebrow">Worked example</p>
              <h2 className="mt-4 text-title font-medium">
                What the learner sees
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
                Nothing below is written by hand. The engine graded these five
                answers against the real answer keys and produced every line.
              </p>
            </div>
            <div className="md:col-span-7">
              <ShowcasePanel showcase={showcase} />
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border">
        <Container className="py-16 md:py-20">
          <h2 className="text-title font-medium">
            Straight answers
          </h2>
          <dl className="mt-10">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="grid gap-2 border-t border-border py-6 md:grid-cols-12 md:gap-8"
              >
                <dt className="text-sm font-medium md:col-span-4">{item.q}</dt>
                <dd className="text-sm leading-6 text-muted md:col-span-8">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Close */}
      <section>
        <Container className="py-16 md:py-24">
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <h2 className="text-title font-medium">
                Free while it is in beta.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted">
                No card. Delete your data whenever you want. If pricing ever
                arrives, you hear about it first.
              </p>
            </div>
            <div className="md:col-span-5 md:justify-self-end">
              <ButtonLink href="/login">Create an account</ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}