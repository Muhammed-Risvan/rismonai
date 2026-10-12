import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { contactHref, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to get in touch about Rismon.",
  openGraph: {
    title: "Contact — Rismon",
    description: "How to get in touch about Rismon.",
    url: "/contact",
    type: "website",
    siteName: siteConfig.name,
  },
};

export default function ContactPage() {
  const emailHref = contactHref();
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <h1 className="text-4xl font-semibold">Contact</h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted">
            <p>
              Questions about Rismon, the private beta, or this site? Email us
              and we will reply as soon as we can.
            </p>
            <p className="font-mono text-sm text-foreground">
              {siteConfig.contactEmail}
            </p>
            <div className="pt-2">
              {emailHref ? (
                <ButtonLink href={emailHref}>Email us</ButtonLink>
              ) : (
                <span className="text-sm text-muted">
                  Email {siteConfig.contactEmail} once the inbox is live.
                </span>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </main>
  );
}
