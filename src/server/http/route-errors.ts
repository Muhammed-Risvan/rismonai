import { ZodError } from "zod";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  UnauthenticatedError,
} from "@/server/errors";

/**
 * Maps errors to HTTP responses with SAFE messages only — never stack
 * traces or raw database errors.
 */
export function jsonError(message: string, status: number, issues?: unknown) {
  const body: Record<string, unknown> = { error: message };
  if (issues !== undefined) {
    body.issues = issues;
  }
  return Response.json(body, { status });
}

export function validationResponse(error: ZodError): Response {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return jsonError("Validation failed", 422, issues);
}

export function badJsonResponse(): Response {
  return jsonError("Invalid JSON body", 400);
}

export function routeErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError) {
    return jsonError("Authentication required", 401);
  }
  if (error instanceof NotFoundError) {
    return jsonError("Not found", 404);
  }
  if (error instanceof InvalidTransitionError) {
    return jsonError("This status change is not allowed", 409);
  }
  if (error instanceof ConflictError) {
    return jsonError(error.message, 409);
  }
  if (error instanceof ZodError) {
    return validationResponse(error);
  }
  return jsonError("Internal server error", 500);
}