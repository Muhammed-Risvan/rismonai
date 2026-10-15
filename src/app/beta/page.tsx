import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { contactHref, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Request beta access",
  description:
    "Rismon is in a private beta. See what the beta includes and how to ask for a spot.",
  openGraph: {
    title: "Request beta access — Rismon",
    description:
      "Rismon is in a private beta. See what the beta includes and how to ask for a spot.",
    url: "/beta",
    type: "website",
    siteName: siteConfig.name,
  },
};

export default function BetaPage() {
  // Real inbox: mailto link goes live automatically via `contactHref`.
  const emailHref = contactHref();
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <Badge variant="accent">Private beta</Badge>
          <h1 className="mt-5 text-4xl font-semibold">
            Rismon is in private beta
          </h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted">
            <p>
              Rismon is being built with a small group of early users. The beta
              is free, and beta testers will be told first if pricing ever
              arrives.
            </p>
            <p>
              Today the beta includes an account, goals, a starting diagnostic and a
              dashboard. The teaching engine — lessons, roadmaps and revision
              — is still in active development, so expect rough edges and
              missing pieces.
            </p>
            <p>
              In return for trying it early, we ask for honest feedback about
              what is useful and what is not.
            </p>
          </div>

          <div className="mt-10 rounded-lg border border-border bg-surface p-8">
            <h2 className="text-xl font-semibold">Create an account</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Accounts are open during the beta. You can delete your data at
              any time, and we do not send marketing email.
            </p>
            <p className="mt-5">
              <ButtonLink href="/login">Create your account</ButtonLink>
            </p>
            <p className="mt-4 text-sm text-muted">
              Would rather ask first?{" "}
              {emailHref ? (
                <a
                  href={emailHref}
                  className="text-accent underline underline-offset-4"
                >
                  Email {siteConfig.contactEmail}
                </a>
              ) : (
                <span>Email {siteConfig.contactEmail} once the inbox is live.</span>
              )}
            </p>
            <p className="mt-4 font-mono text-xs text-muted">
              {siteConfig.contactEmail}
            </p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
