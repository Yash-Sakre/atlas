/**
 * Discovers the third-party packages a project depends on.
 *
 * Reads the declared dependencies from the root (and every workspace)
 * package.json, resolves the actually-installed version from node_modules, and
 * counts how many source files import each package. Purely offline — richer
 * metadata (description, latest version, "update available") is fetched live
 * from the npm registry by the dashboard.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { SourceFile } from 'ts-morph';
import type {
  DependencyInfo,
  DependencyKind,
  DependencyReport,
  DependencySource,
  ExtractionContext,
  ResolvedConfig,
} from '../core/types';
import { detectWorkspaces } from '../core/config';
import { collectModuleSpecifiers } from './moduleRefs';

/** package.json section → our normalized kind, in precedence order (prod wins). */
const KIND_SECTIONS: Array<{ section: string; kind: DependencyKind }> = [
  { section: 'dependencies', kind: 'prod' },
  { section: 'peerDependencies', kind: 'peer' },
  { section: 'optionalDependencies', kind: 'optional' },
  { section: 'devDependencies', kind: 'dev' },
];

function readPkg(dir: string): Record<string, any> | undefined {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Extract the bare package name from an import specifier.
 * "react" → "react", "lodash/merge" → "lodash",
 * "@scope/pkg/sub" → "@scope/pkg". Returns undefined for relative/absolute paths.
 */
function packageOf(spec: string): string | undefined {
  if (!spec || spec.startsWith('.') || spec.startsWith('/')) return undefined;
  const parts = spec.split('/');
  if (spec.startsWith('@')) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined;
  return parts[0];
}

/**
 * Count how many source files reference each bare package, in any syntax:
 * static import, re-export, `await import()`, `require()`.
 */
function countImportsByPackage(sourceFiles: SourceFile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of sourceFiles) {
    const seen = new Set<string>();
    for (const spec of collectModuleSpecifiers(file)) {
      const pkg = packageOf(spec);
      if (pkg) seen.add(pkg);
    }
    for (const pkg of seen) counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
  }
  return counts;
}

/**
 * Infer where a dependency resolves from, based on its declared range.
 * A plain semver range (or a dist-tag like "latest") means the npm registry;
 * anything else is a local link, workspace, git, or url install.
 */
export function classifySource(range: string): DependencySource {
  const r = range.trim();
  if (/^(file:|link:|portal:)/.test(r)) return 'file';
  if (/^workspace:/.test(r)) return 'workspace';
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/.test(r)) return 'git';
  if (/^https?:\/\//.test(r)) {
    return /\.git($|#)|github\.com|gitlab\.com|bitbucket\.org/.test(r) ? 'git' : 'url';
  }
  // "user/repo" or "user/repo#ref" GitHub shorthand (never a valid semver range).
  if (/^[\w.-]+\/[\w.-]+(#.+)?$/.test(r)) return 'git';
  return 'registry';
}

/** Read the installed version of a package from node_modules, if present. */
function installedVersion(root: string, name: string): string | undefined {
  const pkg = readPkg(join(root, 'node_modules', ...name.split('/')));
  return typeof pkg?.version === 'string' ? pkg.version : undefined;
}

export function analyzeDependencies(ctx: ExtractionContext, config: ResolvedConfig): DependencyReport {
  const usage = countImportsByPackage(ctx.sourceFiles);

  // Collect declarations from the root and every workspace package.json. A
  // package declared in more than one place is merged into one row; the highest
  // precedence kind (prod > peer > optional > dev) wins and its first-seen range
  // is kept. Usage is counted globally, so it's attached after the merge.
  const workspaces = detectWorkspaces(config.root);
  const sources: Array<{ dir: string; workspace?: string }> = [
    { dir: config.root },
    ...workspaces.map((ws) => ({ dir: join(config.root, ws.path), workspace: ws.name })),
  ];

  const byName = new Map<string, DependencyInfo>();
  const rank = (k: DependencyKind) => KIND_SECTIONS.findIndex((s) => s.kind === k);

  for (const { dir, workspace } of sources) {
    const pkg = readPkg(dir);
    if (!pkg) continue;
    for (const { section, kind } of KIND_SECTIONS) {
      const deps = pkg[section] as Record<string, string> | undefined;
      if (!deps) continue;
      for (const [name, range] of Object.entries(deps)) {
        const existing = byName.get(name);
        if (existing) {
          // Prefer a more significant kind (a prod dep declared anywhere wins).
          if (rank(kind) < rank(existing.kind)) {
            existing.kind = kind;
            existing.range = range;
            existing.source = classifySource(range);
            existing.npmUrl =
              existing.source === 'registry' ? `https://www.npmjs.com/package/${name}` : undefined;
          }
          if (!existing.workspace && workspace) existing.workspace = workspace;
          continue;
        }
        const source = classifySource(range);
        byName.set(name, {
          name,
          range,
          installed: installedVersion(config.root, name),
          kind,
          source,
          usedInCount: 0,
          workspace,
          npmUrl: source === 'registry' ? `https://www.npmjs.com/package/${name}` : undefined,
        });
      }
    }
  }

  const dependencies = [...byName.values()].map((d) => ({
    ...d,
    usedInCount: usage.get(d.name) ?? 0,
  }));
  dependencies.sort((a, b) => a.name.localeCompare(b.name));

  const counts = { prod: 0, dev: 0, peer: 0, optional: 0, total: dependencies.length };
  for (const d of dependencies) counts[d.kind] += 1;

  return { dependencies, counts };
}
