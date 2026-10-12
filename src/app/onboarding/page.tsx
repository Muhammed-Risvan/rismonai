import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLearner } from "@/server/auth/require-learner";
import { UnauthenticatedError } from "@/server/errors";
import { ambitionDto } from "@/server/http/dto";
import { listAmbitions } from "@/server/services/ambitions";
import { listGoals } from "@/server/services/goals";
import { ensureProfile } from "@/server/services/profile";
import { Container } from "@/components/ui/container";
import { OnboardingForm } from "./onboarding-form";

// Reading the auth session (cookies) is runtime data; this protected route
// blocks on it rather than streaming a static shell (see docs/architecture.md).
export const instant = false;

/**
 * M2 onboarding page.
 *
 * - Unauthenticated → /login.
 * - Returning learner (any existing goal, i.e. a saved selection) →
 *   /dashboard, which shows their persisted journey.
 * - New learner → catalog + SMART form; the server action creates the goal,
 *   links the ambition, and redirects to /dashboard.
 */
export default async function OnboardingPage() {
  let learner;
  try {
    learner = await requireLearner();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw error;
  }

  await ensureProfile(learner.learnerId);
  const goals = await listGoals(learner.learnerId);
  if (goals.length > 0) {
    redirect("/dashboard");
  }

  const ambitions = await listAmbitions();

  return (
    <main id="main" className="flex-1">
      <Container className="py-10">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold">Start your journey</h1>
            <p className="mt-2 text-sm text-muted">
              Pick an ambition and shape your first goal. You can adjust it
              later from your dashboard.
            </p>
          </div>

          {ambitions.length === 0 ? (
            <p role="alert" className="text-sm text-muted">
              No ambitions are available yet. Please check back soon.
            </p>
          ) : (
            <OnboardingForm ambitions={ambitions.map(ambitionDto)} />
          )}

          <p className="text-sm text-muted">
            <Link href="/dashboard" className="underline underline-offset-2">
              Go to dashboard
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
