/** Config loading + framework + workspace detection. */
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import fg from 'fast-glob';
import type { FrameworkInfo, ResolvedConfig, UserConfig } from './types';

const DEFAULT_INCLUDE = ['**/*.{ts,tsx,js,jsx,mjs,cjs}'];
const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.atlas/**',
  '**/*.d.ts',
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/*.stories.{ts,tsx,js,jsx}',
];

const CONFIG_NAMES = [
  'atlas.config.json',
  '.atlasrc',
  '.atlasrc.json',
];

function readUserConfig(root: string): UserConfig {
  for (const name of CONFIG_NAMES) {
    const p = join(root, name);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf8')) as UserConfig;
      } catch (err) {
        throw new Error(`Failed to parse config ${name}: ${(err as Error).message}`);
      }
    }
  }
  // Also support an "atlas" key in package.json.
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.atlas) return pkg.atlas as UserConfig;
    } catch {
      /* ignore */
    }
  }
  return {};
}

export interface ConfigOverrides {
  noCache?: boolean;
  include?: string[];
  exclude?: string[];
  outDir?: string;
}

export function loadConfig(rootInput: string, overrides: ConfigOverrides = {}): ResolvedConfig {
  const root = resolve(rootInput);
  const user = readUserConfig(root);

  return {
    root,
    include: overrides.include ?? user.include ?? DEFAULT_INCLUDE,
    exclude: overrides.exclude ?? [...(user.exclude ?? []), ...DEFAULT_EXCLUDE],
    cache: overrides.noCache ? false : user.cache ?? true,
    outDir: overrides.outDir ?? user.outDir ?? '.atlas',
    plugins: user.plugins ?? [],
    sharedLayers: user.sharedLayers ?? ['shared', 'common', 'core', 'ui', 'lib'],
  };
}

/* ----------------------------- Framework -------------------------------- */

/** Reads the merged dependency map (deps + devDeps) of a package.json, if present. */
export function readDeps(dir: string): Record<string, string> {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

/**
 * Detect the framework(s) used in a directory. `inheritedDeps` lets a monorepo
 * workspace inherit dependencies hoisted to the repo root (so `next`/`react`
 * declared once at the root are still seen by each workspace). Directory probes
 * (`app/`, `pages/`) are always resolved relative to `dir`.
 */
export function detectFramework(dir: string, inheritedDeps: Record<string, string> = {}): FrameworkInfo {
  const root = dir;
  const deps: Record<string, string> = { ...inheritedDeps, ...readDeps(dir) };
  const has = (name: string) => name in deps;

  const next = has('next');
  const hasAppDir =
    existsSync(join(root, 'app')) || existsSync(join(root, 'src', 'app'));
  const hasPagesDir =
    existsSync(join(root, 'pages')) || existsSync(join(root, 'src', 'pages'));

  let nextRouter: FrameworkInfo['nextRouter'] = 'none';
  if (next) {
    if (hasAppDir && hasPagesDir) nextRouter = 'both';
    else if (hasAppDir) nextRouter = 'app';
    else if (hasPagesDir) nextRouter = 'pages';
    else nextRouter = 'app';
  }

  const stateLibs: string[] = [];
  for (const lib of ['zustand', 'jotai', 'recoil', '@reduxjs/toolkit', 'redux', 'react-redux']) {
    if (has(lib)) stateLibs.push(lib);
  }

  return {
    next,
    nextRouter,
    vite: has('vite'),
    reactRouter: has('react-router') || has('react-router-dom'),
    tanstackRouter: has('@tanstack/react-router') || has('@tanstack/router'),
    react: has('react'),
    stateLibs,
  };
}

/* ----------------------------- Workspaces ------------------------------- */

/** Returns workspace package roots (relative) for monorepos. Empty if single-pkg. */
export function detectWorkspaces(root: string): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = [];

  // pnpm-workspace.yaml
  const pnpmWs = join(root, 'pnpm-workspace.yaml');
  let patterns: string[] = [];
  if (existsSync(pnpmWs)) {
    const text = readFileSync(pnpmWs, 'utf8');
    patterns = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).replace(/['"]/g, '').trim());
  }

  // package.json "workspaces" (npm/yarn/turbo)
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const ws = pkg.workspaces;
      if (Array.isArray(ws)) patterns.push(...ws);
      else if (ws?.packages) patterns.push(...ws.packages);
    } catch {
      /* ignore */
    }
  }

  // nx.json presence → treat apps/* and libs/* as workspaces if not declared
  if (existsSync(join(root, 'nx.json')) && patterns.length === 0) {
    patterns = ['apps/*', 'libs/*', 'packages/*'];
  }

  if (patterns.length === 0) return result;

  const pkgGlobs = patterns.map((p) => `${p.replace(/\/$/, '')}/package.json`);
  const found = fg.sync(pkgGlobs, {
    cwd: root,
    ignore: ['**/node_modules/**'],
    absolute: false,
  });

  for (const rel of found) {
    const dir = rel.replace(/\/package\.json$/, '');
    let name = dir;
    try {
      const pkg = JSON.parse(readFileSync(join(root, rel), 'utf8'));
      if (pkg.name) name = pkg.name;
    } catch {
      /* ignore */
    }
    result.push({ name, path: dir });
  }
  return result;
}

export const constants = { DEFAULT_INCLUDE, DEFAULT_EXCLUDE };
