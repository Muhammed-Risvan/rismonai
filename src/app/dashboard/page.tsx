import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLearner } from "@/server/auth/require-learner";
import { UnauthenticatedError } from "@/server/errors";
import { ambitionDto, goalDto, profileDto } from "@/server/http/dto";
import { listAmbitions } from "@/server/services/ambitions";
import { listGoals } from "@/server/services/goals";
import { ensureProfile } from "@/server/services/profile";
import { Container } from "@/components/ui/container";
import { DashboardClient } from "./dashboard-client";

// Reading the auth session (cookies) is runtime data; this protected route
// blocks on it rather than streaming a static shell (see docs/architecture.md).
export const instant = false;

export default async function DashboardPage() {
  let learner;
  try {
    learner = await requireLearner();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw error;
  }

  const profile = await ensureProfile(learner.learnerId);
  const goals = await listGoals(learner.learnerId);
  // M2: catalog names so the dashboard shows each goal's saved ambition
  // selection. The catalog is small, public reference data — one extra read.
  const ambitions = await listAmbitions();

  return (
    <main id="main" className="flex-1">
      <Container className="py-10">
        <p className="text-sm text-muted">
          <Link href="/" className="underline underline-offset-2">
            Home
          </Link>
        </p>
        <DashboardClient
          email={learner.email}
          initialProfile={profileDto(profile)}
          initialGoals={goals.map(goalDto)}
          ambitions={ambitions.map(ambitionDto)}
        />
      </Container>
    </main>
  );
}