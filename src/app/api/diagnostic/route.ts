import { requireLearner } from "@/server/auth/require-learner";
import {
  badJsonResponse,
  routeErrorResponse,
  validationResponse,
} from "@/server/http/route-errors";
import {
  getDiagnosticState,
  optOut,
  reassess,
  startRun,
  submitAnswer,
} from "@/server/services/diagnostic";
import {
  diagnosticAnswerSchema,
  diagnosticOptOutSchema,
} from "@/server/validation/diagnostic";

/**
 * M3 diagnostic API.
 *
 * GET  → resume (returns the learner's current diagnostic state).
 * POST → dispatch on `type`: "start" | "submit" | "optOut" | "reassess".
 *
 * Ownership: the learnerId always comes from `requireLearner()` (the verified
 * Supabase session) — never from the request body. Every service call scopes by
 * it, and the service-level locks recheck ownership inside the transaction.
 */
export async function GET(): Promise<Response> {
  try {
    const { learnerId } = await requireLearner();
    const state = await getDiagnosticState(learnerId);
    return Response.json(state);
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

    const { type, ...payload } = body as Record<string, unknown>;

    switch (type) {
      case "start": {
        return Response.json(await startRun(learnerId));
      }
      case "submit": {
        const parsed = diagnosticAnswerSchema.safeParse(payload);
        if (!parsed.success) {
          return validationResponse(parsed.error);
        }
        return Response.json(
          await submitAnswer(learnerId, parsed.data),
        );
      }
      case "optOut": {
        const parsed = diagnosticOptOutSchema.safeParse(payload);
        if (!parsed.success) {
          return validationResponse(parsed.error);
        }
        return Response.json(await optOut(learnerId, parsed.data.runId));
      }
      case "reassess": {
        return Response.json(await reassess(learnerId));
      }
      default: {
        return badJsonResponse();
      }
    }
  } catch (error) {
    return routeErrorResponse(error);
  }
}
