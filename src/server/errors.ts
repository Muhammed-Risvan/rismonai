/** No valid authenticated session. → 401 */
export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** Resource does not exist OR belongs to another learner (never distinguished). → 404 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Database-level conflict (e.g. two active goals racing the unique index). → 409 */
export class ConflictError extends Error {
  constructor(message = "Conflicting request") {
    super(message);
    this.name = "ConflictError";
  }
}

/** Requested goal status transition is not in the allowed table. → 409 */
export class InvalidTransitionError extends Error {
  constructor(message = "This status change is not allowed") {
    super(message);
    this.name = "InvalidTransitionError";
  }
}