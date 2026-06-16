import { loadConfig, type ConfigOverrides } from '../../core/config';
import { runAnalysis } from '../../core/analyzer';
import { writeJsonOutputs } from '../../output/writer';
import { rankByUsage } from '../../analysis/graphBuilder';
import { allAssets } from '../../core/types';
import { logger, pc } from '../../utils/logger';
import { spinnerHooks } from '../../utils/progress';

export interface AnalyzeFlags {
  root: string;
  noCache?: boolean;
  outDir?: string;
}

export async function analyzeCommand(flags: AnalyzeFlags): Promise<void> {
  const overrides: ConfigOverrides = {
    noCache: flags.noCache,
    outDir: flags.outDir,
  };
  const config = loadConfig(flags.root, overrides);

  logger.banner('atlas · analyze');
  logger.table([
    ['Root', config.root],
    ['Cache', config.cache ? 'on' : 'off'],
    ['Output', config.outDir],
  ]);
  logger.newline();

  const spin = logger.spinner('Scanning & analyzing…');
  const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(spin) });
  spin(`Analyzed ${result.stats.fileCount} files in ${(result.stats.durationMs / 1000).toFixed(2)}s`);
  logger.newline();

  // Persist JSON outputs.
  const { dir } = writeJsonOutputs(result, config.root, config.outDir);

  // Summary.
  logger.success('Components Found', result.stats.components);
  logger.success('Hooks Found', result.stats.hooks);
  logger.success('Utils Found', result.stats.utils);
  logger.success('Contexts/Stores Found', result.stats.contexts);
  logger.success('Routes Found', result.stats.routes);
  logger.newline();

  // Warnings.
  const dc = result.deadCode;
  const warnings: string[] = [];
  if (dc.deadExports.length) warnings.push(`${dc.deadExports.length} unused exports`);
  if (dc.orphanFiles.length) warnings.push(`${dc.orphanFiles.length} orphan files`);
  if (dc.duplicateCandidates.length) warnings.push(`${dc.duplicateCandidates.length} duplicate candidates`);
  if (result.architecture.violations.length)
    warnings.push(`${result.architecture.violations.length} architecture violations`);

  if (warnings.length) {
    logger.raw(pc.yellow(pc.bold('Warnings:')));
    for (const w of warnings) logger.warn(w);
    logger.newline();
  }

  // Most used.
  const top = rankByUsage(allAssets(result), 5).filter((a) => a.usageCount > 0);
  if (top.length) {
    logger.raw(pc.bold('Most used assets:'));
    for (const a of top) logger.raw(`  ${pc.cyan(a.name)} ${pc.dim(`(${a.type})`)} — used ${pc.bold(String(a.usageCount))}×`);
    logger.newline();
  }

  logger.success('JSON written to', dir);
  logger.step(`View the dashboard: ${pc.cyan('atlas serve')}`);
}
