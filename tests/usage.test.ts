import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { analyzeUsage } from '../src/analysis/usageAnalyzer';
import type { Asset, ExtractionContext } from '../src/core/types';

/**
 * Usage analysis must count references that reach an asset through a barrel /
 * re-export (`export … from`), not only direct imports. Otherwise hooks &
 * components imported via an `index.ts` barrel are falsely reported unused.
 */
function hookAsset(path: string, name: string): Asset {
  return {
    id: `${path}#${name}`,
    name,
    type: 'hook',
    path,
    exportType: 'named',
    location: { filePath: path, line: 1, column: 0 },
    signature: `${name}()`,
    params: [],
    returnType: 'unknown',
    reactHooksUsed: [],
    callsHooks: [],
    dependencies: [],
    usedIn: [],
    usageCount: 0,
    examples: [],
    tags: ['hook', 'exported'],
  } as unknown as Asset;
}

function analyze(files: Record<string, string>, assets: Asset[]) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* ReactJSX */ },
  });
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content);
  }
  const ctx = {
    sourceFiles: project.getSourceFiles(),
    root: '/',
  } as unknown as ExtractionContext;
  analyzeUsage(assets, ctx);
}

describe('analyzeUsage re-export resolution', () => {
  it('counts a hook imported through a barrel index', () => {
    const useThing = hookAsset('hooks/useThing.ts', 'useThing');
    analyze(
      {
        '/hooks/useThing.ts': 'export function useThing() { return 1; }',
        '/hooks/index.ts': "export { useThing } from './useThing';",
        '/consumer.ts': "import { useThing } from './hooks';\nexport const go = () => useThing();",
      },
      [useThing],
    );
    expect(useThing.usageCount).toBeGreaterThan(0);
    expect(useThing.usedIn.some((u) => u.kind === 'call')).toBe(true);
  });

  it('counts a hook imported through an aliased re-export', () => {
    const useThing = hookAsset('hooks/useThing.ts', 'useThing');
    analyze(
      {
        '/hooks/useThing.ts': 'export function useThing() { return 1; }',
        '/hooks/index.ts': "export { useThing as useRenamed } from './useThing';",
        '/consumer.ts': "import { useRenamed } from './hooks';\nexport const go = () => useRenamed();",
      },
      [useThing],
    );
    expect(useThing.usageCount).toBeGreaterThan(0);
  });

  it('still counts direct imports (no regression)', () => {
    const useThing = hookAsset('hooks/useThing.ts', 'useThing');
    analyze(
      {
        '/hooks/useThing.ts': 'export function useThing() { return 1; }',
        '/consumer.ts': "import { useThing } from './hooks/useThing';\nexport const go = () => useThing();",
      },
      [useThing],
    );
    expect(useThing.usageCount).toBeGreaterThan(0);
  });

  it('leaves a genuinely unused hook at zero', () => {
    const useThing = hookAsset('hooks/useThing.ts', 'useThing');
    analyze(
      {
        '/hooks/useThing.ts': 'export function useThing() { return 1; }',
        '/hooks/index.ts': "export { useThing } from './useThing';",
        '/consumer.ts': "export const go = () => 42;",
      },
      [useThing],
    );
    expect(useThing.usageCount).toBe(0);
  });
});
