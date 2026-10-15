import { Container } from "@/components/ui/container";

/**
 * Loading shell for the dashboard.
 *
 * This route opts out of instant navigation (it reads the auth session, which
 * is runtime data), so it blocks rather than streaming a static shell. Without
 * this the learner gets a blank frame and no indication anything is happening.
 */
export default function Loading() {
  return (
    <main id="main" className="flex-1">
      <Container className="py-10">
        <p aria-live="polite" className="text-sm text-muted">
          Loading your dashboard…
        </p>
      </Container>
    </main>
  );
}