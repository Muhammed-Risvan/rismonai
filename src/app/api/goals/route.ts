import { requireLearner } from "@/server/auth/require-learner";
import { goalDto } from "@/server/http/dto";
import {
  badJsonResponse,
  routeErrorResponse,
  validationResponse,
} from "@/server/http/route-errors";
import { createGoal, listGoals } from "@/server/services/goals";
import { goalCreateSchema } from "@/server/validation/goals";

export async function GET(): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const goals = await listGoals(learnerId);
    return Response.json(goals.map(goalDto));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badJsonResponse();
    }

    const parsed = goalCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }

    const goal = await createGoal(learnerId, parsed.data);
    return Response.json(goalDto(goal), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}