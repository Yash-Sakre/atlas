/** Filesystem locations used by the dashboard server/export, none inside the
 *  scanned project. Analysis data is cached under the user's home dir. */
import { createHash } from 'crypto';
import { homedir, tmpdir } from 'os';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * Absolute path to the prebuilt React dashboard (`dashboard/dist`). Resolves
 * the same whether running from `src/` (tsx) or compiled `dist/` — both are two
 * levels below the package root.
 */
export function dashboardDistDir(): string {
  return path.resolve(__dirname, '..', '..', 'dashboard', 'dist');
}

/** True when the dashboard has been built and is ready to serve. */
export function dashboardBuilt(): boolean {
  return existsSync(path.join(dashboardDistDir(), 'index.html'));
}

/** Per-project cache dir, keyed by a hash of the absolute root path. */
export function projectCacheDir(root: string): string {
  const hash = createHash('sha1').update(path.resolve(root)).digest('hex').slice(0, 12);
  const base = homedir() || tmpdir();
  return path.join(base, '.atlas', 'cache', hash);
}

export function cachedResultPath(root: string): string {
  return path.join(projectCacheDir(root), 'analysis.json');
}
