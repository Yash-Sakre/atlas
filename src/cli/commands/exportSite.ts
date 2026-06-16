import { cpSync, mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { loadConfig } from '../../core/config';
import { dashboardBuilt, dashboardDistDir, projectCacheDir } from '../../serve/paths';
import { getCachedResult } from '../../serve/result';
import { logger, pc } from '../../utils/logger';

export interface ExportFlags {
  root: string;
  outDir?: string;
  reanalyze?: boolean;
}

/**
 * Emit a self-contained, hostable static bundle (the dashboard + a `data.json`)
 * to an EXTERNAL directory. Deploy that folder to any static host (Netlify,
 * Vercel, S3, GitHub Pages, nginx) — the app fetches `./data.json` at runtime.
 */
export async function exportCommand(flags: ExportFlags): Promise<void> {
  const config = loadConfig(flags.root);
  logger.banner('atlas · export');

  if (!dashboardBuilt()) {
    logger.error('Dashboard bundle not found — build it first:');
    logger.raw(`  ${pc.cyan('npm --prefix dashboard install && npm --prefix dashboard run build')}`);
    process.exitCode = 1;
    return;
  }

  const out = path.resolve(flags.outDir ?? path.join(projectCacheDir(config.root), 'site'));

  // Never write into the scanned codebase — that's the whole point.
  if (out === config.root || out.startsWith(config.root + path.sep)) {
    logger.error('Refusing to export inside the scanned project. Choose a path outside it.');
    logger.raw(`  ${pc.dim('e.g.')} atlas export --out-dir ~/atlas-site`);
    process.exitCode = 1;
    return;
  }

  const result = await getCachedResult(config, flags.reanalyze);

  mkdirSync(out, { recursive: true });
  cpSync(dashboardDistDir(), out, { recursive: true });
  writeFileSync(path.join(out, 'data.json'), JSON.stringify(result), 'utf8');

  logger.newline();
  logger.success('Hostable bundle written to', out);
  logger.step('Deploy this folder to any static host; the app loads ./data.json at runtime.');
  logger.step(`Preview locally: ${pc.cyan(`npx serve ${out}`)}  or  ${pc.cyan('atlas serve')}`);
}
