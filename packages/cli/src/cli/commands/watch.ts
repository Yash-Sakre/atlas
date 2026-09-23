import { watch, mkdirSync, writeFileSync } from 'fs';
import { loadConfig } from '../../core/config';
import { runAnalysis } from '../../core/analyzer';
import { writeJsonOutputs } from '../../output/writer';
import { cachedResultPath, projectCacheDir } from '../../serve/paths';
import { logger } from '../../utils/logger';
import { spinnerHooks } from '../../utils/progress';

/** Re-analyze (incrementally, thanks to the cache) whenever source files change. */
export async function watchCommand(flags: { root: string; outDir?: string }): Promise<void> {
  const config = loadConfig(flags.root, { outDir: flags.outDir });
  logger.banner('atlas · watch');

  let running = false;
  let pending = false;

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    const stop = logger.spinner('Re-analyzing…');
    try {
      const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(stop) });
      writeJsonOutputs(result, config.root, config.outDir);
      // Refresh the dashboard cache so a running/next `serve` sees fresh data.
      mkdirSync(projectCacheDir(config.root), { recursive: true });
      writeFileSync(cachedResultPath(config.root), JSON.stringify(result), 'utf8');
      stop(
        `${result.stats.components} components · ${result.stats.hooks} hooks · ${result.stats.utils} utils · ${result.stats.unusedExports} unused`,
      );
    } catch (err) {
      stop('Analysis failed');
      logger.error((err as Error).message);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        void run();
      }
    }
  };

  await run();
  logger.step('Watching for changes — press Ctrl+C to stop.');

  let timer: NodeJS.Timeout | null = null;
  const watcher = watch(config.root, { recursive: true }, (_evt, file) => {
    if (!file) return;
    const f = file.toString();
    if (!/\.(t|j)sx?$/.test(f)) return;
    if (f.includes('node_modules') || f.includes(config.outDir)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), 250);
  });

  process.on('SIGINT', () => {
    watcher.close();
    logger.newline();
    logger.success('Stopped watching.');
    process.exit(0);
  });
}
