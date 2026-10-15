"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

/**
 * Root route error boundary. Without this file an uncaught client render
 * error shows Next's default blank (dark) screen with no explanation —
 * which reads as a "black page". Never render the raw error: it can carry
 * internals; the digest (if any) is enough for correlation in logs.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <main id="main" className="flex-1">
      <Section>
        <Container size="narrow">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Error
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Something went wrong</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            An unexpected error occurred while showing this page. Your data is
            safe — try again, or head back home.
          </p>
          <div className="mt-8 flex gap-4">
            <Button onClick={reset}>Try again</Button>
            <Button variant="secondary" onClick={() => router.push("/")}>
              Back to home
            </Button>
          </div>
        </Container>
      </Section>
    </main>
  );
}
