"use server";

import { redirect } from "next/navigation";
import { requireLearner } from "@/server/auth/require-learner";
import {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
} from "@/server/errors";
import { startJourney } from "@/server/services/onboarding";
import { onboardingStartSchema } from "@/server/validation/onboarding";

export type StartJourneyResult =
  | { ok: true }
  | { ok: false; message: string };

const INVALID_MESSAGE = "Please check your answers and try again.";
const CONFLICT_MESSAGE =
  "You already have an active learning journey. Continue it on your dashboard.";
const FAILED_MESSAGE = "Could not start your journey. Please try again.";

/**
 * M2 onboarding submission. Thin by design: verifies the session, validates
 * the boundary input with Zod, delegates to `startJourney`, and redirects to
 * the dashboard on success. The learnerId comes only from the verified
 * session — never from the form data.
 */
export async function startJourneyAction(
  formData: FormData,
): Promise<StartJourneyResult> {
  let learnerId: string;
  try {
    ({ learnerId } = await requireLearner());
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw error;
  }

  const parsed = onboardingStartSchema.safeParse({
    ambitionId: formData.get("ambitionId"),
    outcome: formData.get("outcome"),
    hoursPerWeek:
      formData.get("hoursPerWeek") === null ||
      formData.get("hoursPerWeek") === ""
        ? undefined
        : Number(formData.get("hoursPerWeek")),
    background:
      formData.get("background") === null ||
      (typeof formData.get("background") === "string" &&
        (formData.get("background") as string).trim() === "")
        ? undefined
        : formData.get("background"),
    deadline:
      formData.get("deadline") === null || formData.get("deadline") === ""
        ? undefined
        : formData.get("deadline"),
  });
  if (!parsed.success) {
    return { ok: false, message: INVALID_MESSAGE };
  }

  try {
    await startJourney(learnerId, parsed.data);
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, message: CONFLICT_MESSAGE };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, message: INVALID_MESSAGE };
    }
    return { ok: false, message: FAILED_MESSAGE };
  }

  redirect("/dashboard");
}
