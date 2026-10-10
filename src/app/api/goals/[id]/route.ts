import { requireLearner } from "@/server/auth/require-learner";
import { goalDto } from "@/server/http/dto";
import {
  badJsonResponse,
  routeErrorResponse,
  validationResponse,
} from "@/server/http/route-errors";
import { getGoal, updateGoal } from "@/server/services/goals";
import { goalUpdateSchema } from "@/server/validation/goals";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const { id } = await params;
    const goal = await getGoal(learnerId, id);
    return Response.json(goalDto(goal));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badJsonResponse();
    }

    const parsed = goalUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }

    const goal = await updateGoal(learnerId, id, parsed.data);
    return Response.json(goalDto(goal));
  } catch (error) {
    return routeErrorResponse(error);
  }
}