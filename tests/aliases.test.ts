import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readBuildAliases } from '../src/core/aliases';
import { loadConfig } from '../src/core/config';
import { runAnalysis } from '../src/core/analyzer';

/**
 * Regression: aliases declared only in vite.config (not tsconfig `paths`) must
 * still resolve, otherwise every `@/…` import fails to bind and the target is
 * falsely reported as unused / dead code.
 */
describe('readBuildAliases (vite resolve.alias parsing)', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'atlas-alias-'));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const write = (vite: string) => writeFileSync(join(root, 'vite.config.ts'), vite);

  it('parses object form with path.resolve/__dirname', () => {
    write(`import path from 'path';
export default { resolve: { alias: {
  '@': path.resolve(__dirname, './src'),
  '@ui': path.resolve(__dirname, 'src/components/ui'),
} } };`);
    const paths = readBuildAliases(root);
    expect(paths['@/*']).toEqual(['src/*']);
    expect(paths['@ui/*']).toEqual(['src/components/ui/*']);
  });

  it('parses fileURLToPath(new URL(...)) form', () => {
    write(`import { fileURLToPath } from 'url';
export default { resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } };`);
    expect(readBuildAliases(root)['@/*']).toEqual(['src/*']);
  });

  it('parses array {find, replacement} form with root-relative paths', () => {
    write(`export default { resolve: { alias: [{ find: '@', replacement: '/src' }] } };`);
    expect(readBuildAliases(root)['@/*']).toEqual(['src/*']);
  });

  it('returns empty when there is no vite config', () => {
    const empty = mkdtempSync(join(tmpdir(), 'atlas-noalias-'));
    try {
      expect(readBuildAliases(empty)).toEqual({});
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('vite-alias resolution end-to-end', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'atlas-alias-e2e-'));
    mkdirSync(join(root, 'src', 'components'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { react: '*' } }));
    // tsconfig deliberately has NO paths — the alias lives only in vite.config.
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx' }, include: ['src'] }));
    writeFileSync(
      join(root, 'vite.config.ts'),
      `import path from 'path';\nexport default { resolve: { alias: { '@': path.resolve(__dirname, 'src') } } };`,
    );
    writeFileSync(
      join(root, 'src', 'components', 'AddCameraDialog.tsx'),
      `export function AddCameraDialog() { return <div>dialog</div>; }`,
    );
    writeFileSync(
      join(root, 'src', 'CamerasPage.tsx'),
      `import { AddCameraDialog } from '@/components/AddCameraDialog';\nexport function CamerasPage() { return <AddCameraDialog />; }`,
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('counts usage through a vite-only alias and does not flag it dead', async () => {
    const result = await runAnalysis(loadConfig(root, { ai: 'none', noCache: true }), { skipDocs: true });
    const dialog = result.components.find((c) => c.name === 'AddCameraDialog');
    expect(dialog?.usageCount).toBeGreaterThan(0);
    expect(result.deadCode.unusedComponents.map((c) => c.name)).not.toContain('AddCameraDialog');
  }, 30_000);
});

/**
 * Regression: aliases in split build configs (electron-forge's
 * `vite.renderer.config.mts`, etc.) must be discovered, not just `vite.config.*`.
 */
describe('readBuildAliases (split vite config discovery)', () => {
  it('discovers aliases declared in vite.renderer.config.mts', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-split-'));
    try {
      writeFileSync(
        join(root, 'vite.renderer.config.mts'),
        `import path from 'path';\nexport default { resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } } };`,
      );
      expect(readBuildAliases(root)['@/*']).toEqual(['src/*']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * Regression (monorepo): when Atlas scans from the repo root, a `@/…` alias that
 * lives only in a workspace's own tsconfig (one level down) must still resolve, so
 * the workspace's components aren't falsely reported as unused / dead code.
 */
describe('monorepo workspace-alias resolution end-to-end', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'atlas-monorepo-'));
    const ws = join(root, 'apps', 'desktop');
    mkdirSync(join(ws, 'src', 'dialogs'), { recursive: true });
    mkdirSync(join(ws, 'src', 'pages'), { recursive: true });
    // Monorepo root: declares workspaces, hoists react, and has NO tsconfig at all.
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*'], dependencies: { react: '*' } }),
    );
    // The `@/*` alias lives ONLY in the workspace tsconfig, one level down.
    writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'desktop' }));
    writeFileSync(
      join(ws, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', moduleResolution: 'bundler', baseUrl: '.', paths: { '@/*': ['./src/*'] } },
        include: ['src'],
      }),
    );
    writeFileSync(
      join(ws, 'src', 'dialogs', 'AddCameraDialog.tsx'),
      `export function AddCameraDialog() { return <div>dialog</div>; }`,
    );
    writeFileSync(
      join(ws, 'src', 'pages', 'CamerasPage.tsx'),
      `import { AddCameraDialog } from '@/dialogs/AddCameraDialog';\nexport function CamerasPage() { return <AddCameraDialog />; }`,
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('resolves a workspace-local @/ alias when scanning from the monorepo root', async () => {
    const result = await runAnalysis(loadConfig(root, { ai: 'none', noCache: true }), { skipDocs: true });
    const dialog = result.components.find((c) => c.name === 'AddCameraDialog');
    expect(dialog?.usageCount).toBeGreaterThan(0);
    expect(result.deadCode.unusedComponents.map((c) => c.name)).not.toContain('AddCameraDialog');
  }, 30_000);
});
