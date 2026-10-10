import { requireLearner } from "@/server/auth/require-learner";
import { profileDto } from "@/server/http/dto";
import {
  badJsonResponse,
  routeErrorResponse,
  validationResponse,
} from "@/server/http/route-errors";
import { ensureProfile, updateProfile } from "@/server/services/profile";
import { profileUpdateSchema } from "@/server/validation/profile";

export async function GET(): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const profile = await ensureProfile(learnerId);
    return Response.json(profileDto(profile));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badJsonResponse();
    }

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }

    const profile = await updateProfile(learnerId, parsed.data);
    return Response.json(profileDto(profile));
  } catch (error) {
    return routeErrorResponse(error);
  }
}