import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLearner } from "@/server/auth/require-learner";
import { UnauthenticatedError } from "@/server/errors";
import { goalDto, profileDto } from "@/server/http/dto";
import { listGoals } from "@/server/services/goals";
import { ensureProfile } from "@/server/services/profile";
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

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
      </p>
      <DashboardClient
        email={learner.email}
        initialProfile={profileDto(profile)}
        initialGoals={goals.map(goalDto)}
      />
    </main>
  );
}