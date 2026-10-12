import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy (draft)",
  description:
    "Draft privacy notice describing what Rismon stores today: account, goals and profile, essential auth cookies, no analytics.",
  openGraph: {
    title: "Privacy (draft) — Rismon",
    description:
      "Draft privacy notice describing what Rismon stores today: account, goals and profile, essential auth cookies, no analytics.",
    url: "/privacy",
    type: "website",
    siteName: siteConfig.name,
  },
};

function DraftNotice() {
  return (
    <div
      className="rounded-lg border border-accent/60 p-4"
      role="note"
      aria-label="Draft notice"
    >
      <Badge variant="accent">DRAFT, pending review</Badge>
      <p className="mt-3 text-sm leading-6 text-muted">
        This page is a working draft and has not been reviewed. It only
        describes what the app does today.
      </p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <h1 className="text-4xl font-semibold">Privacy</h1>
          <div className="mt-6">
            <DraftNotice />
          </div>

          <div className="mt-8 space-y-6 text-base leading-7 text-muted">
            <section aria-labelledby="who">
              <h2 id="who" className="text-xl font-semibold text-foreground">
                Who runs this site
              </h2>
              <p className="mt-2">
                Rismon is run by{" "}
                <strong className="text-foreground">
                  {siteConfig.companyName}
                </strong>
                , from the house of{" "}
                <strong className="text-foreground">
                  {siteConfig.parentCompanyName}
                </strong>
                , registered in{" "}
                <strong className="text-foreground">
                  {siteConfig.jurisdiction}
                </strong>
                . The jurisdiction is a placeholder until the real details are
                confirmed. Contact:{" "}
                <strong className="text-foreground">{siteConfig.contactEmail}</strong>.
              </p>
            </section>

            <section aria-labelledby="stored">
              <h2 id="stored" className="text-xl font-semibold text-foreground">
                What is stored today
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-foreground">Account:</strong> your
                  email address and password, handled by Supabase
                  Authentication (passwords are stored hashed by Supabase).
                </li>
                <li>
                  <strong className="text-foreground">Goals:</strong> the
                  learning goals you create (title, description, target
                  outcome, deadline, hours per week, status).
                </li>
                <li>
                  <strong className="text-foreground">Profile:</strong> your
                  display name and timezone.
                </li>
                <li>
                  <strong className="text-foreground">Hosting:</strong> the app
                  is hosted on Vercel; the database and accounts live on
                  Supabase.
                </li>
                <li>
                  <strong className="text-foreground">Cookies:</strong>{" "}
                  essential authentication cookies only, so you stay signed in.
                  No analytics or advertising cookies are used.
                </li>
              </ul>
            </section>

            <section aria-labelledby="not-used">
              <h2
                id="not-used"
                className="text-xl font-semibold text-foreground"
              >
                What is not happening
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>No analytics.</li>
                <li>No advertising or tracking.</li>
                <li>No AI processing of your content yet.</li>
                <li>No selling or sharing of your data.</li>
              </ul>
            </section>

            <section
              aria-labelledby="placeholders"
              className="rounded-lg border border-dashed border-border p-4"
            >
              <h2
                id="placeholders"
                className="text-xl font-semibold text-foreground"
              >
                Placeholders — will be written before these features go live
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                <li>
                  <strong className="text-foreground">
                    AI-provider data handling (placeholder):
                  </strong>{" "}
                  no AI provider is connected today. How inputs would be sent
                  to an AI provider, and how that provider handles them, will
                  be described here before any such feature goes live.
                </li>
                <li>
                  <strong className="text-foreground">Waitlist (placeholder):</strong>{" "}
                  no waitlist form exists yet. If one is added, what it
                  collects and how it is used will be described here before it
                  goes live.
                </li>
              </ul>
            </section>

            <p className="text-sm">
              This draft deliberately makes no claims about legal compliance,
              retention periods or data exports — those will only be written
              once they are true.
            </p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
