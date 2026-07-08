/** Sets up the ts-morph Project, scans source files, builds the ExtractionContext. */
import { existsSync } from 'fs';
import { join, relative } from 'path';
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
 * Merge path aliases declared in build configs (e.g. Vite `resolve.alias`) into
 * the project's compiler `paths`, so `@/…` imports resolve even when they aren't
 * mirrored in tsconfig. tsconfig's own `paths` take precedence on conflict — if
 * an alias already resolves, we don't touch it. No-op when nothing is found.
 */
function applyBuildAliases(project: Project, root: string): void {
  const discovered = readBuildAliases(root);
  if (Object.keys(discovered).length === 0) return;

  const opts = project.getCompilerOptions();
  const merged = { ...discovered, ...(opts.paths ?? {}) }; // tsconfig wins
  project.compilerOptions.set({
    paths: merged,
    // `paths` needs a base to resolve against; keep tsconfig's if set, else root.
    baseUrl: opts.baseUrl ?? root,
  });
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
