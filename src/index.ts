#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { totalmem } from 'os';

/**
 * Re-exec the compiled CLI with a larger V8 heap on first launch.
 *
 * Node's default old-space limit is often ~2 GB regardless of installed RAM, and
 * scanning a large frontend repo (full type-checking thousands of files) needs
 * more. We relaunch once with --max-old-space-size sized to the host's memory,
 * guarded by an env flag to avoid an infinite loop. Returns true if the launch
 * replaced this process (caller should not continue).
 */
function boostHeapIfNeeded(): boolean {
  if (process.env.ATLAS_HEAP_BOOSTED) return false;
  const entry = process.argv[1];
  // Only re-exec the compiled CLI; dev (tsx) and unusual entry points run as-is.
  if (!entry || !entry.endsWith('.js')) return false;
  if (process.execArgv.some((a) => a.startsWith('--max-old-space-size'))) return false;
  if ((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size')) return false;

  const MB = 1024 * 1024;
  const heapMB = Math.max(4096, Math.min(8192, Math.floor((totalmem() * 0.75) / MB)));

  const res = spawnSync(
    process.execPath,
    [`--max-old-space-size=${heapMB}`, entry, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, ATLAS_HEAP_BOOSTED: '1' } },
  );
  if (res.error) return false; // spawn failed → fall through and run in-process
  process.exit(res.status ?? 0);
}

if (!boostHeapIfNeeded()) {
  // Deferred require so the heavy module graph never loads in the launcher process.
  import('./cli')
    .then(({ buildCli }) => buildCli().parseAsync(process.argv))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
