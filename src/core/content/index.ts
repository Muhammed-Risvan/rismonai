/**
 * Public surface of the learning-content contracts (M0). Import content types
 * and validators from here so the rest of the app builds against one stable
 * boundary. Pure modules only — no DB, network, or clock.
 */
export {
  ambitionSchema,
  ambitionCatalogEntrySchema,
  competencyMapSchema,
  type Ambition,
  type AmbitionCatalogEntry,
  type CompetencyMap,
} from "./ambition";
export {
  capabilitySchema,
  exerciseSchema,
  lessonSchema,
  misconceptionSchema,
  objectiveSchema,
  answerKeySchema,
  type AnswerKey,
  type Capability,
  type Exercise,
  type Lesson,
  type Misconception,
  type Objective,
} from "./schema";
export {
  isoDateSchema,
  levelSchema,
  semverSchema,
  slugSchema,
} from "./primitives";
export {
  InvalidCompetencyMapError,
  assertValidPrerequisiteDag,
  isValidPrerequisiteDag,
  type CapabilityGraphInput,
} from "./dag";
export {
  assertValidReferences,
  isValidReferences,
} from "./references";
export {
  validateCompetencyMap,
  formatZodError,
  type CompetencyMapValidation,
} from "./validate";
