/** Bridges runAnalysis progress hooks to a live CLI spinner label. */
import type { AnalyzeHooks } from '../core/analyzer';
import type { Spinner } from './logger';

/**
 * Wire a spinner to the analysis lifecycle: the label tracks the current phase
 * and shows file/asset counts during the two long phases (extraction + docs).
 */
export function spinnerHooks(spin: Spinner): AnalyzeHooks {
  return {
    onPhase: (phase) => spin.update(`${phase}…`),
    onExtractProgress: (done, total) => spin.update(`Extracting assets — ${done}/${total} files`),
    onDescribeProgress: (done, total) => spin.update(`Generating documentation — ${done}/${total}`),
  };
}
