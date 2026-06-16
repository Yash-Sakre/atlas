import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { Project } from 'ts-morph';
import { RouteExtractor } from '../src/extractors/routeExtractor';
import { loadConfig } from '../src/core/config';
import { runAnalysis } from '../src/core/analyzer';
import type { ExtractionContext, FrameworkInfo, RouteAsset } from '../src/core/types';

const FW: Record<string, FrameworkInfo> = {
  reactRouter: { next: false, nextRouter: 'none', vite: true, reactRouter: true, tanstackRouter: false, react: true, stateLibs: [] },
  tanstack: { next: false, nextRouter: 'none', vite: true, reactRouter: false, tanstackRouter: true, react: true, stateLibs: [] },
};

/** Run the RouteExtractor over a single in-memory source file with a stub context. */
function extract(code: string, framework: FrameworkInfo, file = 'src/routes.tsx'): RouteAsset[] {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const sf = project.createSourceFile(`/proj/${file}`, code);
  const ctx = {
    root: '/proj',
    framework,
    frameworkOf: () => framework,
    workspaceOf: () => undefined,
  } as unknown as ExtractionContext;
  return new RouteExtractor().extract(sf, ctx);
}

describe('RouteExtractor — React Router (data router config)', () => {
  const routes = extract(
    `
    import { createBrowserRouter } from 'react-router-dom';
    export const router = createBrowserRouter([
      {
        path: '/',
        element: <Root />,
        children: [
          { index: true, element: <Home /> },
          { path: 'settings', lazy: () => import('./pages/Settings') },
        ],
      },
    ]);
    `,
    FW.reactRouter,
  );

  it('extracts parent, index, and lazy child routes', () => {
    const byPath = new Map(routes.map((r) => [r.routePath, r]));
    expect(byPath.has('/')).toBe(true);
    expect(byPath.has('(index)')).toBe(true);
    expect(byPath.get('settings')?.componentName).toBe('lazy(Settings)');
    expect(routes.every((r) => r.router === 'react-router')).toBe(true);
  });

  it('records direct child paths on the parent route', () => {
    const root = routes.find((r) => r.routePath === '/')!;
    expect(root.childRoutes.sort()).toEqual(['(index)', 'settings']);
  });
});

describe('RouteExtractor — TanStack Router', () => {
  const routes = extract(
    `
    import { createRootRoute, createRoute, createFileRoute } from '@tanstack/react-router';
    export const rootRoute = createRootRoute({ component: RootLayout });
    export const postsRoute = createRoute({ path: '/posts/$postId', component: PostView });
    export const Route = createFileRoute('/about')({ component: About });
    `,
    FW.tanstack,
  );

  it('detects root, createRoute, and file routes with TanStack param syntax', () => {
    const byPath = new Map(routes.map((r) => [r.routePath, r]));
    expect(routes.every((r) => r.router === 'tanstack-router')).toBe(true);
    expect(byPath.get('/')?.segmentKind).toBe('layout'); // createRootRoute
    expect(byPath.get('/posts/:postId')?.componentName).toBe('PostView'); // $postId → :postId
    expect(byPath.get('/about')?.componentName).toBe('About'); // createFileRoute config
  });
});

describe('RouteExtractor — framework gating', () => {
  it('does not emit Next.js or TanStack routes for a pure react-router workspace', () => {
    const routes = extract(
      `import { createFileRoute } from '@tanstack/react-router';
       export const Route = createFileRoute('/x')({ component: X });`,
      FW.reactRouter,
    );
    // tanstackRouter is false for this workspace → the createFileRoute call is ignored.
    expect(routes).toHaveLength(0);
  });
});

describe('per-workspace framework detection (monorepo)', () => {
  it('detects Next.js app-router routes in a workspace even when the repo root is not Next.js', async () => {
    const root = join(__dirname, 'fixtures', 'monorepo');
    const result = await runAnalysis(loadConfig(root, { noCache: true }), { skipDocs: true });

    // Root package.json has no `next` dep; the route only resolves if detection
    // is done per-workspace (apps/web). This was the original "empty routes" bug.
    const paths = result.routes.map((r) => r.routePath);
    expect(paths).toContain('/dashboard');
    expect(result.routes.every((r) => r.router === 'next-app')).toBe(true);
    expect(result.routes.find((r) => r.routePath === '/dashboard')?.workspace).toBe('web');
  });
});
