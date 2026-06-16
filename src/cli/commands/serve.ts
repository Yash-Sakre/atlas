import { loadConfig } from '../../core/config';
import { dashboardBuilt, dashboardDistDir } from '../../serve/paths';
import { getCachedResult } from '../../serve/result';
import { openBrowser, startServer } from '../../serve/server';
import { logger, pc } from '../../utils/logger';

export interface ServeFlags {
  root: string;
  port?: string;
  open?: boolean;
  reanalyze?: boolean;
}

export async function serveCommand(flags: ServeFlags): Promise<void> {
  const config = loadConfig(flags.root);
  logger.banner('atlas · serve');

  if (!dashboardBuilt()) {
    logger.error('Dashboard bundle not found — it has not been built yet.');
    logger.raw(`  ${pc.cyan('npm --prefix dashboard install && npm --prefix dashboard run build')}`);
    process.exitCode = 1;
    return;
  }

  const result = await getCachedResult(config, flags.reanalyze);
  const dataStr = JSON.stringify(result);

  const port = flags.port ? parseInt(flags.port, 10) : 4321;
  const srv = await startServer({ distDir: dashboardDistDir(), getData: () => dataStr, port });

  logger.newline();
  logger.success('Dashboard running at', pc.cyan(srv.url));
  logger.step('Nothing was written into your codebase. Press Ctrl+C to stop.');
  if (flags.open !== false) openBrowser(srv.url);

  const shutdown = () => {
    srv.close();
    logger.newline();
    logger.step('Server stopped.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive while the server runs.
  await new Promise<void>(() => {});
}
