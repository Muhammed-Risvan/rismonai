import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLearner } from "@/server/auth/require-learner";
import { UnauthenticatedError } from "@/server/errors";
import { ambitionDto } from "@/server/http/dto";
import { listAmbitions } from "@/server/services/ambitions";
import { getDiagnosticState } from "@/server/services/diagnostic";
import { Container } from "@/components/ui/container";
import { DiagnosticClient } from "./diagnostic-client";

// Reading the auth session (cookies) is runtime data; this protected route
// blocks on it rather than streaming a static shell (see docs/architecture.md).
export const instant = false;

export default async function DiagnosticPage() {
  let learner;
  try {
    learner = await requireLearner();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw error;
  }

  // The server owns the initial state: the client never decides readiness or
  // progress, it only renders what the engine reports.
  const state = await getDiagnosticState(learner.learnerId);
  // Needed only for the "link an ambition" recovery path (an unlinked goal
  // can never reach a diagnostic). Small, public reference data.
  const ambitions =
    state.status === "no-ambition"
      ? (await listAmbitions()).map(ambitionDto)
      : [];

  return (
    <main id="main" className="flex-1">
      <Container className="py-10">
        <p className="text-sm text-muted">
          <Link href="/dashboard" className="underline underline-offset-2">
            Dashboard
          </Link>
        </p>
        <DiagnosticClient initialState={state} ambitions={ambitions} />
      </Container>
    </main>
  );
}