import { Container } from "@/components/ui/container";

/** Loading shell for the diagnostic (session-reading route). */
export default function Loading() {
  return (
    <main id="main" className="flex-1">
      <Container className="py-10">
        <p aria-live="polite" className="text-sm text-muted">
          Loading your starting point…
        </p>
      </Container>
    </main>
  );
}