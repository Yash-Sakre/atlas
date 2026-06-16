/** Loads a previously written analysis.json, or runs analysis on the fly. */
import { existsSync, readFileSync } from 'fs';
import type { AnalysisResult, ResolvedConfig } from '../core/types';
import { resultPath } from '../output/writer';
import { runAnalysis } from '../core/analyzer';
import { logger } from '../utils/logger';
import { spinnerHooks } from '../utils/progress';

export async function loadOrAnalyze(config: ResolvedConfig): Promise<AnalysisResult> {
  const p = resultPath(config.root, config.outDir);
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as AnalysisResult;
    } catch {
      logger.warn('Existing analysis.json is corrupt — re-analyzing.');
    }
  }
  logger.step('No analysis found — running analyze first…');
  const spin = logger.spinner('Analyzing codebase…');
  const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(spin) });
  spin('Analysis complete');
  return result;
}
