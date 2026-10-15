import { requireLearner } from "@/server/auth/require-learner";
import { goalDto } from "@/server/http/dto";
import {
  routeErrorResponse,
  validationResponse,
} from "@/server/http/route-errors";
import { setGoalAmbition } from "@/server/services/ambitions";
import { goalAmbitionSchema } from "@/server/validation/ambitions";

/**
 * PATCH /api/goals/[id]/ambition — links (or clears) a goal's ambition.
 *
 * This exists because a goal created from the dashboard has no ambition by
 * default, and an unlinked goal can never reach the diagnostic or a roadmap
 * (the service reports `no-ambition`). Linking is a separate, explicit action
 * so a learner who already started a journey can attach it retroactively.
 *
 * Ownership is enforced inside the service (`learnerId` from the verified
 * session only); a foreign or missing goal yields an indistinguishable 404.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = goalAmbitionSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }

    const goal = await setGoalAmbition(learnerId, id, parsed.data.ambitionId);
    return Response.json(goalDto(goal));
  } catch (error) {
    return routeErrorResponse(error);
  }
}