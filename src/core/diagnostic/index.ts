/**
 * Public surface of the M3 diagnostic core (pure).
 *
 * Everything here is deterministic: bank ordering, adaptive selection,
 * answer-key grading, coverage, initial levels, and immutable run
 * snapshots. No DB, network, or clock.
 */
export {
  buildDiagnosticBank,
  type DiagnosticBank,
  type DiagnosticBankEntry,
} from "./bank";
export {
  gradeDiagnosticAnswer,
  normalizeDiagnosticResponse,
} from "./grading";
export {
  detectMisconception,
  gradeWithMisconception,
  type MisconceptionLookup,
  type MisconceptionSignature,
} from "./misconception";
export {
  nextDiagnosticItem,
  type DiagnosticAnswers,
} from "./selection";
export {
  DIAGNOSTIC_CEILING,
  isCapabilityCovered,
  isRunComplete,
  initialLevelFor,
  itemsForCapability,
  pendingConditionalItem,
} from "./coverage";
export {
  MAX_SNAPSHOT_ITEMS,
  buildItemsSnapshot,
  diagnosticSnapshotItemSchema,
  diagnosticSnapshotSchema,
  type DiagnosticSnapshot,
  type DiagnosticSnapshotItem,
} from "./snapshot";
