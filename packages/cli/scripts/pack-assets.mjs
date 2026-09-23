// Gathers what the published tarball needs from elsewhere in the monorepo:
// the built dashboard (packages/dashboard/dist → dashboard/) plus the root
// README and LICENSE. Runs from `prepack`; all three copies are gitignored.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '..', '..');
const dashboardDist = join(repoRoot, 'packages', 'dashboard', 'dist');

if (!existsSync(join(dashboardDist, 'index.html'))) {
  console.error(`Dashboard build not found at ${dashboardDist} — run \`npm run build\` from the repo root first.`);
  process.exit(1);
}

const bundled = join(pkgRoot, 'dashboard');
rmSync(bundled, { recursive: true, force: true });
cpSync(dashboardDist, bundled, { recursive: true });
for (const file of ['README.md', 'LICENSE']) cpSync(join(repoRoot, file), join(pkgRoot, file));

console.log('Bundled dashboard, README and LICENSE into the CLI package.');
