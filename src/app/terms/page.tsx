import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms (draft)",
  description:
    "Draft terms for the Rismon private beta — plain-language, and honest about what the service is today.",
  openGraph: {
    title: "Terms (draft) — Rismon",
    description:
      "Draft terms for the Rismon private beta — plain-language, and honest about what the service is today.",
    url: "/terms",
    type: "website",
    siteName: siteConfig.name,
  },
};

export default function TermsPage() {
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <h1 className="text-4xl font-semibold">Terms</h1>

          <div className="mt-6 rounded-lg border border-accent/60 p-4" role="note" aria-label="Draft notice">
            <Badge variant="accent">DRAFT, pending review</Badge>
            <p className="mt-3 text-sm leading-6 text-muted">
              This page is a working draft and has not been reviewed. It only
              describes what the service is today.
            </p>
          </div>

          <div className="mt-8 space-y-6 text-base leading-7 text-muted">
            <section aria-labelledby="what-is">
              <h2 id="what-is" className="text-xl font-semibold text-foreground">
                What Rismon is
              </h2>
              <p className="mt-2">
                Rismon is an early private beta of a learning tool. You can
                create an account, set goals and track them. The learning
                engine is still being built. The service may change, break or
                stop at any time while it is in beta.
              </p>
            </section>

            <section aria-labelledby="beta">
              <h2 id="beta" className="text-xl font-semibold text-foreground">
                The beta
              </h2>
              <p className="mt-2">
                The beta is free. It is offered as-is, without guarantees of
                availability or accuracy. Do not rely on Rismon as your only
                record of anything important.
              </p>
            </section>

            <section aria-labelledby="account">
              <h2 id="account" className="text-xl font-semibold text-foreground">
                Your account
              </h2>
              <p className="mt-2">
                Keep your login details to yourself and tell us if you think
                your account has been compromised. You are responsible for what
                you enter under your account.
              </p>
            </section>

            <section aria-labelledby="fair-use">
              <h2 id="fair-use" className="text-xl font-semibold text-foreground">
                Fair use
              </h2>
              <p className="mt-2">
                Do not try to break the service, access other people&apos;s
                accounts, or use Rismon for anything illegal. We may suspend
                accounts that do that.
              </p>
            </section>

            <section aria-labelledby="changes">
              <h2 id="changes" className="text-xl font-semibold text-foreground">
                Changes
              </h2>
              <p className="mt-2">
                These terms will be reviewed before the public launch and
                updated if the service changes. Continued use after a change
                means you accept the updated terms.
              </p>
            </section>

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
                confirmed. Questions?{" "}
                <Link
                  href="/contact"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Contact us
                </Link>
                .
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </main>
  );
}
