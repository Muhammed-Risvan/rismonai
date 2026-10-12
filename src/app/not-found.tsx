import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            404
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            That page does not exist, or it has moved.
          </p>
          <div className="mt-8">
            <ButtonLink href="/">Back to home</ButtonLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
