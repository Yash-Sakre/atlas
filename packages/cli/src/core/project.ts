/** Sets up the ts-morph Project, scans source files, builds the ExtractionContext. */
import { existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import fg from 'fast-glob';
import { Project, type SourceFile } from 'ts-morph';
import type { ExtractionContext, FrameworkInfo, ResolvedConfig } from './types';
import { detectFramework, detectWorkspaces, readDeps } from './config';
import { readBuildAliases } from './aliases';

export interface LoadedProject {
  project: Project;
  sourceFiles: SourceFile[];
  ctx: ExtractionContext;
}

export function loadProject(config: ResolvedConfig): LoadedProject {
  const tsConfigPath = findTsConfig(config.root);

  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      jsx: 4 /* ReactJSX */,
      noEmit: true,
    },
  });

  const files = fg.sync(config.include, {
    cwd: config.root,
    ignore: config.exclude,
    absolute: true,
    dot: false,
  });

  const sourceFiles: SourceFile[] = [];
  for (const abs of files) {
    try {
      sourceFiles.push(project.addSourceFileAtPath(abs));
    } catch {
      /* unreadable / parse error → skip */
    }
  }

  applyBuildAliases(project, config.root);

  const framework = detectFramework(config.root);
  const workspaces = detectWorkspaces(config.root);

  // Per-workspace framework detection. Each workspace inherits the root's
  // hoisted deps but its own package.json + app/pages dirs take precedence,
  // so a Next.js app under apps/* is detected even when the repo root is not.
  const rootDeps = readDeps(config.root);
  const wsFrameworks: { path: string; framework: FrameworkInfo }[] = workspaces.map((ws) => ({
    path: ws.path,
    framework: detectFramework(join(config.root, ws.path), rootDeps),
  }));

  const matchWorkspace = <T,>(filePath: string, list: { path: string; value: T }[]): T | undefined => {
    const rel = filePath.replace(/\\/g, '/');
    let best: { path: string; value: T } | undefined;
    for (const item of list) {
      if (rel === item.path || rel.startsWith(item.path + '/')) {
        if (!best || item.path.length > best.path.length) best = item;
      }
    }
    return best?.value;
  };

  const workspaceOf = (filePath: string): string | undefined =>
    matchWorkspace(filePath, workspaces.map((ws) => ({ path: ws.path, value: ws.name })));

  const frameworkOf = (filePath: string): FrameworkInfo =>
    matchWorkspace(filePath, wsFrameworks.map((w) => ({ path: w.path, value: w.framework }))) ?? framework;

  const ctx: ExtractionContext = {
    project,
    sourceFiles,
    config,
    framework,
    root: config.root,
    workspaceOf,
    frameworkOf,
  };

  return { project, sourceFiles, ctx };
}

/**
 * Build a single tsconfig-style `paths` map that resolves alias imports across an
 * entire monorepo, and apply it to the project.
 *
 * A ts-morph `Project` has exactly one `baseUrl`, but a monorepo has many configs
 * (the root tsconfig, the root build config, and every workspace's own tsconfig +
 * build config) each with its own base. So every alias target from every source is
 * **rebased to be relative to the scan root**, and `baseUrl` is pinned to that
 * root. Same-key aliases from multiple workspaces (e.g. each app's own `@/*`) are
 * merged into an ordered candidate list — TS tries each until one resolves —
 * rather than one workspace clobbering another. No-op when nothing is discovered.
 */
function applyBuildAliases(project: Project, root: string): void {
  const merged: Record<string, string[]> = {};
  const add = (key: string, targets: string[]): void => {
    const list = merged[key] ?? (merged[key] = []);
    for (const t of targets) if (!list.includes(t)) list.push(t);
  };

  // 1. Root tsconfig's own `paths`, rebased from its baseUrl to the scan root.
  const opts = project.getCompilerOptions();
  const rootBase = opts.baseUrl ? resolve(root, opts.baseUrl) : root;
  for (const [key, targets] of Object.entries(opts.paths ?? {})) {
    add(key, (targets as string[]).map((t) => rebase(t, rootBase, root)));
  }

  // 2. Root build-config (Vite) aliases — already relative to root.
  for (const [key, targets] of Object.entries(readBuildAliases(root))) {
    add(key, targets.map((t) => rebase(t, root, root)));
  }

  // 3. Each workspace's tsconfig + build-config aliases, rebased to the scan root.
  //    This is what lets `@/…` imports inside `apps/desktop` resolve when Atlas is
  //    pointed at the monorepo root, where the alias only lives one level down.
  for (const ws of detectWorkspaces(root)) {
    const wsAbs = join(root, ws.path);
    const wsTs = readTsConfigAliases(wsAbs);
    if (wsTs) {
      for (const [key, targets] of Object.entries(wsTs.paths)) {
        add(key, targets.map((t) => rebase(t, wsTs.baseUrl, root)));
      }
    }
    for (const [key, targets] of Object.entries(readBuildAliases(wsAbs))) {
      add(key, targets.map((t) => rebase(t, wsAbs, root)));
    }
  }

  if (Object.keys(merged).length === 0) return;
  project.compilerOptions.set({ paths: merged, baseUrl: root });
}

/**
 * Read a tsconfig/jsconfig's `paths` (with an absolute baseUrl) from `dir` without
 * pulling its files into the analysis. Resolves `extends` chains via ts-morph.
 * Returns undefined when the config is missing or declares no `paths`.
 */
function readTsConfigAliases(dir: string): { baseUrl: string; paths: Record<string, string[]> } | undefined {
  const tsConfigPath = findTsConfig(dir);
  if (!tsConfigPath) return undefined;
  try {
    const scratch = new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true });
    const opts = scratch.getCompilerOptions();
    if (!opts.paths || Object.keys(opts.paths).length === 0) return undefined;
    // TS makes baseUrl absolute when set; if absent, `paths` are relative to the config dir.
    const baseUrl = opts.baseUrl ? resolve(dir, opts.baseUrl) : dir;
    return { baseUrl, paths: opts.paths as Record<string, string[]> };
  } catch {
    return undefined;
  }
}

/** Rebase an alias target (which may contain a `*` glob) from one base dir to another. */
function rebase(target: string, fromBase: string, toBase: string): string {
  return relative(toBase, resolve(fromBase, target)).replace(/\\/g, '/') || '.';
}

function findTsConfig(root: string): string | undefined {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function rel(root: string, abs: string): string {
  return relative(root, abs).replace(/\\/g, '/');
}
