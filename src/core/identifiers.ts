/**
 * Branded identifier types for the learning domain (M0 contracts).
 *
 * These are compile-time guards that prevent mixing different kinds of ids
 * (e.g. passing an ExerciseId where a CapabilityId is expected). They are
 * pure: the brand is a phantom `unique symbol` erased at compile time, and
 * the runtime constructors are identity functions. No DB, network, or clock.
 *
 * The learner id is intentionally NOT branded here: the existing codebase
 * passes `learnerId` around as a plain `string` sourced from the verified
 * session, and this contract keeps that convention (see services/goals.ts).
 */

declare const BRAND: unique symbol;

/** Adds a phantom brand `B` to a base type `T` (compile-time only). */
export type Brand<T, B extends string> = T & { readonly [BRAND]: B };

export type AmbitionId = Brand<string, "AmbitionId">;
export type CapabilityId = Brand<string, "CapabilityId">;
export type ObjectiveId = Brand<string, "ObjectiveId">;
export type LessonId = Brand<string, "LessonId">;
export type ExerciseId = Brand<string, "ExerciseId">;
export type MisconceptionId = Brand<string, "MisconceptionId">;

export function ambitionId(value: string): AmbitionId {
  return value as AmbitionId;
}
export function capabilityId(value: string): CapabilityId {
  return value as CapabilityId;
}
export function objectiveId(value: string): ObjectiveId {
  return value as ObjectiveId;
}
export function lessonId(value: string): LessonId {
  return value as LessonId;
}
export function exerciseId(value: string): ExerciseId {
  return value as ExerciseId;
}
export function misconceptionId(value: string): MisconceptionId {
  return value as MisconceptionId;
}
