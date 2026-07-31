import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Project } from 'ts-morph';
import { analyzeUsage } from '../src/analysis/usageAnalyzer';
import { loadConfig } from '../src/core/config';
import { runAnalysis } from '../src/core/analyzer';
import { allAssets, type Asset, type ExtractionContext } from '../src/core/types';

/**
 * Lazily loaded modules (`await import()`, `React.lazy`, `next/dynamic`,
 * `require`) must bind exactly like static imports. Otherwise every code-split
 * component and every deferred util is falsely reported unused / dead code.
 */

function asset(path: string, name: string, over: Partial<Asset> = {}): Asset {
  return {
    id: `${path}#${name}`,
    name,
    type: 'utility',
    path,
    exportType: 'named',
    location: { filePath: path, line: 1, column: 0 },
    signature: `${name}()`,
    params: [],
    returnType: 'unknown',
    dependencies: [],
    usedIn: [],
    usageCount: 0,
    examples: [],
    tags: [],
    ...over,
  } as unknown as Asset;
}

const component = (path: string, name: string, exportType: 'default' | 'named' = 'default'): Asset =>
  asset(path, name, { type: 'component', exportType, rendersComponents: [], props: [] } as Partial<Asset>);

function analyze(files: Record<string, string>, assets: Asset[]): void {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      jsx: 4 /* ReactJSX */,
      esModuleInterop: true,
      baseUrl: '/',
      paths: { '@/*': ['*'] },
    },
  });
  for (const [path, content] of Object.entries(files)) project.createSourceFile(path, content);
  analyzeUsage(assets, { sourceFiles: project.getSourceFiles(), root: '/' } as unknown as ExtractionContext);
}

describe('dynamic import() binding', () => {
  it('binds destructured named exports: const { heavy } = await import(…)', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': `export async function go() {
  const { heavy } = await import('./utils/heavy');
  return heavy();
}`,
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
    expect(heavy.usedIn[0].kind).toBe('call');
  });

  it('binds an aliased destructure: const { heavy: h } = await import(…)', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = async () => { const { heavy: h } = await import('./utils/heavy'); return h(); };",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('binds the module object as a namespace: const m = await import(…); m.heavy()', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = async () => { const m = await import('./utils/heavy'); return m.heavy(); };",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('records a direct member read: (await import(…)).heavy()', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = async () => (await import('./utils/heavy')).heavy();",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('binds a .then() callback parameter', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = () => import('./utils/heavy').then((m) => m.heavy());",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('binds a destructured .then() callback parameter', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = () => import('./utils/heavy').then(({ heavy }) => heavy());",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('resolves through a tsconfig path alias', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "export const go = async () => { const { heavy } = await import('@/utils/heavy'); return heavy(); };",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('resolves through a barrel re-export', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/utils/index.ts': "export { heavy } from './heavy';",
        '/consumer.ts': "export const go = async () => { const { heavy } = await import('./utils'); return heavy(); };",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('counts a type-position import: import("./m").Props', () => {
    const panel = component('Panel.tsx', 'Panel', 'named');
    analyze(
      {
        '/Panel.tsx': 'export function Panel() { return <div />; }',
        '/consumer.ts': "export type Rendered = ReturnType<typeof import('./Panel').Panel>;",
      },
      [panel],
    );
    expect(panel.usageCount).toBe(1);
  });

  it('ignores a computed specifier without crashing', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    expect(() =>
      analyze(
        {
          '/utils/heavy.ts': 'export function heavy() { return 1; }',
          '/consumer.ts': 'export const go = async (n: string) => import(`./utils/${n}`);',
        },
        [heavy],
      ),
    ).not.toThrow();
    expect(heavy.usageCount).toBe(0);
  });
});

describe('React.lazy / next dynamic', () => {
  it('binds lazy(() => import(…)) to the default export and counts the JSX', () => {
    const panel = component('Panel.tsx', 'Panel');
    analyze(
      {
        '/Panel.tsx': 'export default function Panel() { return <div />; }',
        '/App.tsx': `import { lazy } from 'react';
const Panel = lazy(() => import('./Panel'));
export default function App() { return <Panel />; }`,
      },
      [panel],
    );
    expect(panel.usageCount).toBe(1);
    expect(panel.usedIn[0].kind).toBe('jsx');
  });

  it('binds through a renamed local: const Lazy = React.lazy(() => import(…))', () => {
    const panel = component('Panel.tsx', 'Panel');
    analyze(
      {
        '/Panel.tsx': 'export default function Panel() { return <div />; }',
        '/App.tsx': `import React from 'react';
const Lazy = React.lazy(() => import('./Panel'));
export default function App() { return <Lazy />; }`,
      },
      [panel],
    );
    expect(panel.usageCount).toBe(1);
  });

  it('binds next/dynamic with an options object', () => {
    const panel = component('Panel.tsx', 'Panel');
    analyze(
      {
        '/Panel.tsx': 'export default function Panel() { return <div />; }',
        '/App.tsx': `import dynamic from 'next/dynamic';
const Panel = dynamic(() => import('./Panel'), { ssr: false });
export default function App() { return <Panel />; }`,
      },
      [panel],
    );
    expect(panel.usageCount).toBe(1);
  });

  it('binds a block-bodied loader: lazy(() => { return import(…); })', () => {
    const panel = component('Panel.tsx', 'Panel');
    analyze(
      {
        '/Panel.tsx': 'export default function Panel() { return <div />; }',
        '/App.tsx': `import { lazy } from 'react';
const Panel = lazy(() => { return import('./Panel'); });
export default function App() { return <Panel />; }`,
      },
      [panel],
    );
    expect(panel.usageCount).toBe(1);
  });

  it('binds a named export promoted to default via .then', () => {
    const panel = component('Panel.tsx', 'Panel', 'named');
    analyze(
      {
        '/Panel.tsx': 'export function Panel() { return <div />; }',
        '/App.tsx': `import { lazy } from 'react';
const Renamed = lazy(() => import('./Panel').then((m) => ({ default: m.Panel })));
export default function App() { return <Renamed />; }`,
      },
      [panel],
    );
    // once for `m.Panel` in the loader, once for the <Renamed /> render
    expect(panel.usageCount).toBe(2);
    expect(panel.usedIn.some((u) => u.kind === 'jsx')).toBe(true);
  });

  it('keeps a route-object `lazy: () => import(…)` target reachable', () => {
    const dashboard = component('Dashboard.tsx', 'Dashboard', 'named');
    analyze(
      {
        '/Dashboard.tsx': 'export function Dashboard() { return <div />; }',
        '/routes.ts': `export const routes = [
  { path: '/dash', lazy: () => import('./Dashboard') },
];`,
      },
      [dashboard],
    );
    expect(dashboard.usageCount).toBe(1);
    expect(dashboard.usedIn[0].kind).toBe('import');
  });

  it('keeps a bare side-effect import reachable', () => {
    const setup = asset('setup.ts', 'setup');
    analyze(
      {
        '/setup.ts': 'export function setup() {}',
        '/main.ts': "export const boot = async () => { await import('./setup'); };",
      },
      [setup],
    );
    expect(setup.usageCount).toBe(1);
    expect(setup.usedIn[0].kind).toBe('import');
  });
});

describe('require() / import = require()', () => {
  it('binds a require() namespace', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "const m = require('./utils/heavy');\nexport const go = () => m.heavy();",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('binds a destructured require()', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "const { heavy } = require('./utils/heavy');\nexport const go = () => heavy();",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });

  it('binds import x = require(…)', () => {
    const heavy = asset('utils/heavy.ts', 'heavy');
    analyze(
      {
        '/utils/heavy.ts': 'export function heavy() { return 1; }',
        '/consumer.ts': "import m = require('./utils/heavy');\nexport const go = () => m.heavy();",
      },
      [heavy],
    );
    expect(heavy.usageCount).toBe(1);
  });
});

describe('dynamic imports end-to-end', () => {
  let root: string;
  let result: Awaited<ReturnType<typeof runAnalysis>>;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'atlas-dynamic-'));
    mkdirSync(join(root, 'src', 'components'), { recursive: true });
    mkdirSync(join(root, 'src', 'utils'), { recursive: true });
    const w = (p: string, c: string) => writeFileSync(join(root, p), c);

    w('package.json', JSON.stringify({ name: 'dyn', dependencies: { react: '*', lodash: '*' } }));
    w(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', module: 'esnext', target: 'esnext', moduleResolution: 'bundler' },
      }),
    );

    w('src/components/LazyPanel.tsx', 'export default function LazyPanel() { return <div>panel</div>; }');
    w('src/components/NamedLazy.tsx', 'export function NamedLazy() { return <div>named</div>; }');
    w('src/utils/heavy.ts', 'export function heavyCalc(x: number) { return x * 2; }');
    w('src/utils/required.ts', 'export function requiredFn(x: number) { return x; }');

    w(
      'src/App.tsx',
      `import { lazy, Suspense } from 'react';

const LazyPanel = lazy(() => import('./components/LazyPanel'));
const Renamed = lazy(() => import('./components/NamedLazy').then((m) => ({ default: m.NamedLazy })));

export default function App() {
  const go = async () => {
    const { heavyCalc } = await import('./utils/heavy');
    const { debounce } = await import('lodash');
    const req = require('./utils/required');
    return heavyCalc(2) + req.requiredFn(1) + Number(!!debounce);
  };
  return <Suspense><LazyPanel /><Renamed /><button onClick={go} /></Suspense>;
}`,
    );

    result = await runAnalysis(await loadConfig(root, {}), { skipDocs: true });
  }, 120_000);

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const find = (name: string) => allAssets(result).find((a) => a.name === name);

  it('counts every lazily loaded asset', () => {
    expect(find('LazyPanel')?.usageCount).toBeGreaterThan(0);
    expect(find('NamedLazy')?.usageCount).toBeGreaterThan(0);
    expect(find('heavyCalc')?.usageCount).toBeGreaterThan(0);
    expect(find('requiredFn')?.usageCount).toBeGreaterThan(0);
  });

  it('reports no false dead code or orphan files', () => {
    expect(result.deadCode.unusedComponents.map((d) => d.name)).toEqual([]);
    expect(result.deadCode.unusedUtils.map((d) => d.name)).toEqual([]);
    expect(result.deadCode.orphanFiles).toEqual([]);
  });

  it('draws graph edges from the lazy loader to its target', () => {
    const edges = result.graph.edges.map((e) => `${e.from} ${e.kind} ${e.to}`);
    expect(edges).toContain('src/App.tsx#App uses src/components/LazyPanel.tsx#LazyPanel');
    expect(edges).toContain('src/App.tsx#App uses src/components/NamedLazy.tsx#NamedLazy');
    expect(edges).toContain('src/App.tsx#App uses src/utils/heavy.ts#heavyCalc');
  });

  it('counts packages loaded via await import()', () => {
    const lodash = result.dependencies.dependencies.find((d) => d.name === 'lodash');
    expect(lodash?.usedInCount).toBe(1);
  });
});
