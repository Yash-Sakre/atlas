/** Obtain an analysis result for the dashboard without writing into the
 *  scanned project — caches under the user's home dir instead. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { AnalysisResult, ResolvedConfig } from '../core/types';
import { runAnalysis } from '../core/analyzer';
import { logger, pc } from '../utils/logger';
import { spinnerHooks } from '../utils/progress';
import { cachedResultPath, projectCacheDir } from './paths';

export async function getCachedResult(
  config: ResolvedConfig,
  reanalyze?: boolean,
): Promise<AnalysisResult> {
  const cacheFile = cachedResultPath(config.root);

  if (!reanalyze && existsSync(cacheFile)) {
    try {
      const r = JSON.parse(readFileSync(cacheFile, 'utf8')) as AnalysisResult;
      logger.step(`Loaded cached analysis ${pc.dim('(use --reanalyze to refresh)')}`);
      return r;
    } catch {
      /* corrupt cache — re-analyze */
    }
  }

  const spin = logger.spinner('Analyzing codebase…');
  const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(spin) });
  spin(`Analyzed ${result.stats.fileCount} files in ${(result.stats.durationMs / 1000).toFixed(2)}s`);

  mkdirSync(projectCacheDir(config.root), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(result), 'utf8');
  return result;
}
