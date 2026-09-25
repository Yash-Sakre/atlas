import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfig } from '../src/core/config';
import { runAnalysis } from '../src/core/analyzer';
import type { AnalysisResult, Asset } from '../src/core/types';

/**
 * Stat accuracy on patterns seen in a real app, where each one used to skew a
 * dashboard number: self-exports counted as usage, stores built through a
 * local zustand wrapper, section-style route manifests, constants-only imports
 * flagging a file as orphaned, nested `index` barrels treated as entry files,
 * tool-only dependencies reported unused, and README mentions keeping assets
 * "referenced".
 */
describe('stat accuracy (integration)', () => {
  let root: string;
  let result: AnalysisResult;
  let byId: Map<string, Asset>;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'atlas-accuracy-'));
    const write = (rel: string, data: string) => {
      const abs = join(root, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, data);
    };

    write(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        scripts: { lint: 'biome lint .', build: 'cross-env NODE_ENV=production vite build' },
        dependencies: { react: '^19.0.0', 'react-router-dom': '^7.0.0', zustand: '^5.0.0' },
        devDependencies: {
          '@biomejs/biome': '^2.0.0',
          '@types/react': '^19.0.0',
          'cross-env': '^7.0.0',
          postcss: '^8.0.0',
          tailwindcss: '^3.0.0',
          'left-pad': '^1.0.0',
        },
      }),
    );
    write('postcss.config.cjs', 'module.exports = { plugins: { tailwindcss: {} } };');
    write('public/used.png', 'png');
    write('public/documented-only.png', 'png');
    write('NOTES.md', 'Old logo: `public/documented-only.png`');

    // Stores go through a project wrapper, never `zustand` directly.
    write(
      'src/store/createStore.js',
      `import { create as zustandCreate } from 'zustand';
export const create = (init) => zustandCreate(init);
`,
    );
    write(
      'src/store/themeStore.js',
      `import { create } from './createStore';
export const useThemeStore = create((set) => ({ mode: 'dark', toggle: () => set({}) }));
`,
    );

    // Only a constant is imported from here; its lone function is unused.
    write(
      'src/constants.js',
      `export const COLORS = { a: 1 };
export function unusedHelper() { return 1; }
`,
    );

    // A nested barrel is not an entry file.
    write('src/lib/index.js', 'export function neverImported() { return 1; }\n');

    write(
      'src/Card.jsx',
      `const Card = () => <div />;
export default Card;
`,
    );
    // Hooks and helpers that build JSX inside their data.
    write(
      'src/tree.jsx',
      `import Card from './Card';
export function useTree() { return [{ title: <Card /> }]; }
export function buildColumns() { return [{ render: () => <Card /> }]; }
`,
    );

    write(
      'src/routes/define.js',
      'export const defineSection = (s) => s;\n',
    );
    write(
      'src/routes/reports.jsx',
      `import { defineSection } from './define';
import Report from '../Report';
import Scheduler from '../Scheduler';
const flag = true;
export default defineSection({
  path: 'reports',
  title: 'Reports',
  screens: [
    { index: true, component: Report },
    ...(flag ? [{ path: 'scheduler', component: Scheduler }] : []),
  ],
});
`,
    );
    write('src/Report.jsx', 'export default function Report() { return <p />; }\n');
    write('src/Scheduler.jsx', 'export default function Scheduler() { return <p />; }\n');
    write('src/Home.jsx', 'export default function Icon() { return <i />; }\n');
    write(
      'src/main.jsx',
      `import sections from './routes/reports';
import { COLORS } from './constants';
import { useThemeStore } from './store/themeStore';
import { useTree, buildColumns } from './tree';
import Icon from './Home';
import ErrorPage from './ErrorPage';
export const routes = [
  sections,
  { path: '*', element: <ErrorPage icon={<Icon />} /> },
];
export function App() {
  useThemeStore();
  useTree();
  buildColumns();
  return <img src="/used.png" data-c={COLORS.a} />;
}
`,
    );
    write('src/ErrorPage.jsx', 'export default function ErrorPage() { return <p />; }\n');

    const config = loadConfig(root, { ai: 'none', noCache: true });
    result = await runAnalysis(config, { skipDocs: true });
    byId = new Map(
      [...result.components, ...result.hooks, ...result.utils, ...result.contexts].map((a) => [a.id, a as Asset]),
    );
  }, 30_000);

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('does not count `export default X` as a usage of X', () => {
    const card = byId.get('src/Card.jsx#Card')!;
    expect(card.usedIn.every((u) => u.filePath !== 'src/Card.jsx')).toBe(true);
    expect(card.usageCount).toBe(2);
  });

  it('detects stores created through a local zustand wrapper', () => {
    const store = result.contexts.find((c) => c.name === 'useThemeStore');
    expect(store?.type).toBe('store');
    expect(store?.stateKind).toBe('zustand');
    expect(store?.usageCount).toBeGreaterThan(0);
  });

  it('keeps use* hooks and camelCase helpers that build JSX', () => {
    expect(result.hooks.some((h) => h.name === 'useTree')).toBe(true);
    expect(result.utils.some((u) => u.name === 'buildColumns')).toBe(true);
  });

  it('finds section roots passed to a helper and feature-flagged spread routes', () => {
    const paths = result.routes.map((r) => r.routePath);
    expect(paths).toEqual(expect.arrayContaining(['reports', '(index)', 'scheduler', '*']));
    const reports = result.routes.find((r) => r.routePath === 'reports')!;
    expect(reports.childRoutes).toEqual(['(index)', 'scheduler']);
    expect(reports.location.line).toBe(5);
  });

  it('names the page a route renders, not JSX passed as a prop', () => {
    expect(result.routes.find((r) => r.routePath === '*')?.componentName).toBe('ErrorPage');
  });

  it('never reports a file as orphaned when a non-asset export is imported', () => {
    expect(result.deadCode.orphanFiles).not.toContain('src/constants.js');
    expect(result.deadCode.deadExports.map((d) => d.id)).toContain('src/constants.js#unusedHelper');
  });

  it('reports unused exports in nested index barrels', () => {
    expect(result.deadCode.deadExports.map((d) => d.id)).toContain('src/lib/index.js#neverImported');
  });

  it('marks script, config and type-only dependencies as tooling, not unused', () => {
    const dep = new Map(result.dependencies.dependencies.map((d) => [d.name, d]));
    expect(dep.get('@biomejs/biome')?.toolingUse).toContain('script');
    expect(dep.get('cross-env')?.toolingUse).toContain('script');
    expect(dep.get('tailwindcss')?.toolingUse).toContain('config');
    expect(dep.get('postcss')?.toolingUse).toContain('config');
    expect(dep.get('@types/react')?.toolingUse).toContain('types');
    expect(dep.get('left-pad')?.toolingUse).toBeUndefined();
    expect(dep.get('left-pad')?.usedInCount).toBe(0);
  });

  it('ignores plain markdown mentions when counting static asset references', () => {
    const byPath = new Map(result.staticAssets.assets.map((a) => [a.path, a]));
    expect(byPath.get('public/used.png')?.usageCount).toBeGreaterThan(0);
    expect(byPath.get('public/documented-only.png')?.usageCount).toBe(0);
  });
});
