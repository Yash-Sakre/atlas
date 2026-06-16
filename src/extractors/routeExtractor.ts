/**
 * Route extractor.
 *
 * Routing is defined by the framework's own contract:
 *   - Next.js App Router  → file role (page/layout/route/...) + directory path
 *   - Next.js Pages Router→ file path under pages/
 *   - React Router        → <Route path element> JSX, createBrowserRouter([...]),
 *                           or lazy/nested object config
 *   - TanStack Router      → createFileRoute('/path'), createRoute({ path }),
 *                           createRootRoute(), new Route({ path })
 * For Next.js the path-based mapping IS the semantic source of truth (the
 * framework derives URLs from the filesystem), so it is correct to use it here.
 *
 * Detection is monorepo-aware: each file is classified against its own
 * workspace's framework (ctx.frameworkOf) rather than the repo root, so a
 * Next.js or React Router app nested under apps/* is detected correctly.
 */
import { Node, SyntaxKind, type JsxAttribute, type SourceFile } from 'ts-morph';
import type { Extractor, ExtractionContext, RouteAsset, RouterKind } from '../core/types';
import { rel } from '../core/project';
import { getLeadingJsDoc, location, makeId } from './ast-utils';

const NEXT_SEGMENTS = ['page', 'layout', 'route', 'template', 'loading', 'error', 'default', 'not-found'];

export class RouteExtractor implements Extractor<RouteAsset> {
  name = 'route';
  produces = 'route' as const;

  extract(file: SourceFile, ctx: ExtractionContext): RouteAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const fw = ctx.frameworkOf(relPath);
    const out: RouteAsset[] = [];

    if (fw.next) {
      const appRoute = this.nextAppRoute(file, relPath, ctx);
      if (appRoute) out.push(appRoute);
      const pagesRoute = this.nextPagesRoute(file, relPath, ctx);
      if (pagesRoute) out.push(pagesRoute);
    }

    // React Router and TanStack Router routes are expressed in code, not the
    // filesystem. Gate on detected deps; fall back to attempting both when the
    // workspace's framework is unknown (no package.json / non-React project),
    // since the JSX/call signatures matched below are specific enough.
    const unknown = !fw.next && !fw.reactRouter && !fw.tanstackRouter;
    if (fw.reactRouter || fw.react || unknown) {
      out.push(...this.reactRouterRoutes(file, relPath, ctx));
    }
    if (fw.tanstackRouter || unknown) {
      out.push(...this.tanstackRoutes(file, relPath, ctx));
    }
    return out;
  }

  /* --------------------------- Next.js App Router ------------------------ */
  private nextAppRoute(file: SourceFile, relPath: string, ctx: ExtractionContext): RouteAsset | null {
    const m = relPath.match(/(?:^|\/)(?:src\/)?app\/(.*)$/);
    if (!m) return null;
    const rest = m[1];
    const base = rest.split('/').pop()!.replace(/\.(t|j)sx?$/, '');
    if (!NEXT_SEGMENTS.includes(base)) return null;
    if (!['page', 'route', 'layout'].includes(base)) return null;

    const slash = rest.lastIndexOf('/');
    const dir = slash === -1 ? '' : rest.slice(0, slash);
    const routePath = appSegmentsToPath(dir);
    const name = `${routePath === '/' ? 'root' : routePath} (${base})`;

    return this.make(
      file,
      relPath,
      name,
      'next-app',
      routePath,
      base as RouteAsset['segmentKind'],
      ctx,
    );
  }

  /* -------------------------- Next.js Pages Router ----------------------- */
  private nextPagesRoute(file: SourceFile, relPath: string, ctx: ExtractionContext): RouteAsset | null {
    const m = relPath.match(/(?:^|\/)(?:src\/)?pages\/(.*)\.(t|j)sx?$/);
    if (!m) return null;
    let rest = m[1];
    if (/^_(app|document|error)$/.test(rest.split('/').pop()!)) return null;
    const isApi = rest.startsWith('api/');
    const routePath = pagesSegmentsToPath(rest);
    return this.make(file, relPath, `${routePath}${isApi ? ' (api)' : ''}`, 'next-pages', routePath, 'page', ctx);
  }

  /* ----------------------------- React Router ---------------------------- */
  private reactRouterRoutes(file: SourceFile, relPath: string, ctx: ExtractionContext): RouteAsset[] {
    const out: RouteAsset[] = [];

    // JSX: <Route path="/x" element={<X/>} />
    const jsxRoutes = [
      ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ].filter((el) => el.getTagNameNode().getText() === 'Route');

    for (const el of jsxRoutes) {
      const attrs = el.getAttributes().filter(Node.isJsxAttribute) as JsxAttribute[];
      const pathAttr = attrs.find((a) => a.getNameNode().getText() === 'path');
      const indexAttr = attrs.find((a) => a.getNameNode().getText() === 'index');
      const routePath = pathAttr ? attrValue(pathAttr) : indexAttr ? '(index)' : undefined;
      if (routePath === undefined) continue;
      const elementAttr =
        attrs.find((a) => a.getNameNode().getText() === 'element') ??
        attrs.find((a) => a.getNameNode().getText() === 'Component');
      const componentName = elementAttr ? extractComponentName(elementAttr) : undefined;
      out.push(
        this.make(file, relPath, `${routePath} → ${componentName ?? '?'}`, 'react-router', routePath, 'route', ctx, componentName),
      );
    }

    // Object config: createBrowserRouter([{ path, element/Component }]) or useRoutes([...])
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText();
      if (!/(createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|createRoutesFromElements)$/.test(callee)) {
        continue;
      }
      const arg = call.getArguments()[0];
      if (arg && Node.isArrayLiteralExpression(arg)) {
        for (const r of collectRouteObjects(arg)) {
          out.push(
            this.make(file, relPath, `${r.path} → ${r.component ?? '?'}`, 'react-router', r.path, 'route', ctx, r.component, r.children),
          );
        }
      }
    }

    return out;
  }

  /* ---------------------------- TanStack Router -------------------------- */
  private tanstackRoutes(file: SourceFile, relPath: string, ctx: ExtractionContext): RouteAsset[] {
    const out: RouteAsset[] = [];

    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText();
      const base = callee.split('.').pop() ?? callee;

      // createFileRoute('/posts/$postId')  /  createLazyFileRoute('/about')
      if (base === 'createFileRoute' || base === 'createLazyFileRoute') {
        const arg = call.getArguments()[0];
        if (arg && Node.isStringLiteral(arg)) {
          const routePath = tanstackPathToUrl(arg.getLiteralValue());
          const component = componentFromConfig(call.getParent());
          out.push(this.make(file, relPath, `${routePath} → ${component ?? '?'}`, 'tanstack-router', routePath, 'route', ctx, component));
        }
        continue;
      }

      // createRootRoute(...) / rootRouteWithContext(...)() → the app shell
      if (base === 'createRootRoute' || base === 'createRootRouteWithContext') {
        const component = componentFromObjectArg(call);
        out.push(this.make(file, relPath, `/ (root) → ${component ?? '?'}`, 'tanstack-router', '/', 'layout', ctx, component));
        continue;
      }

      // createRoute({ path, component }) / new Route({ path, component })
      if (base === 'createRoute') {
        const r = routeFromObjectArg(call.getArguments()[0]);
        if (r) out.push(this.make(file, relPath, `${r.path} → ${r.component ?? '?'}`, 'tanstack-router', r.path, 'route', ctx, r.component));
      }
    }

    for (const ne of file.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      if (ne.getExpression().getText().split('.').pop() !== 'Route') continue;
      const r = routeFromObjectArg(ne.getArguments()?.[0]);
      if (r) out.push(this.make(file, relPath, `${r.path} → ${r.component ?? '?'}`, 'tanstack-router', r.path, 'route', ctx, r.component));
    }

    return out;
  }

  private make(
    file: SourceFile,
    relPath: string,
    name: string,
    router: RouterKind,
    routePath: string,
    segmentKind: RouteAsset['segmentKind'],
    ctx: ExtractionContext,
    componentName?: string,
    childRoutes: string[] = [],
  ): RouteAsset {
    return {
      id: makeId(relPath, `route:${routePath}:${router}`),
      name,
      type: 'route',
      path: relPath,
      exportType: 'none',
      location: location(file, relPath),
      jsDoc: getLeadingJsDoc(file),
      signature: `${router} ${routePath}`,
      router,
      routePath,
      componentName,
      childRoutes,
      segmentKind,
      dependencies: [],
      usedIn: [],
      usageCount: 0,
      examples: [],
      tags: ['route', router, segmentKind ?? 'route'],
      workspace: ctx.workspaceOf(relPath),
    };
  }
}

/* ------------------------------- helpers --------------------------------- */

function appSegmentsToPath(dir: string): string {
  if (!dir) return '/';
  const segments = dir
    .split('/')
    .filter(Boolean)
    .filter((s) => !/^\(.*\)$/.test(s)) // route groups (marketing) don't affect URL
    .filter((s) => !/^@/.test(s)) // parallel routes @slot
    .map(segmentToUrl);
  const path = '/' + segments.join('/');
  return path === '/' ? '/' : path.replace(/\/$/, '');
}

function pagesSegmentsToPath(rest: string): string {
  const segments = rest.split('/').filter(Boolean);
  if (segments[segments.length - 1] === 'index') segments.pop();
  const path = '/' + segments.map(segmentToUrl).join('/');
  return path === '/' ? '/' : path.replace(/\/$/, '');
}

function segmentToUrl(seg: string): string {
  // [...slug] → *, [[...slug]] → *?, [id] → :id
  if (/^\[\[\.\.\..+\]\]$/.test(seg)) return '*?';
  if (/^\[\.\.\..+\]$/.test(seg)) return '*';
  const m = seg.match(/^\[(.+)\]$/);
  if (m) return `:${m[1]}`;
  return seg;
}

function attrValue(attr: JsxAttribute): string | undefined {
  const init = attr.getInitializer();
  if (!init) return undefined;
  if (Node.isStringLiteral(init)) return init.getLiteralValue();
  if (Node.isJsxExpression(init)) {
    const expr = init.getExpression();
    if (expr && Node.isStringLiteral(expr)) return expr.getLiteralValue();
    return expr?.getText();
  }
  return undefined;
}

function extractComponentName(attr: JsxAttribute): string | undefined {
  const init = attr.getInitializer();
  if (!init) return undefined;
  if (Node.isJsxExpression(init)) {
    const expr = init.getExpression();
    if (!expr) return undefined;
    // element={<Foo/>}
    if (Node.isJsxSelfClosingElement(expr) || Node.isJsxElement(expr)) {
      const open = Node.isJsxElement(expr) ? expr.getOpeningElement() : expr;
      return open.getTagNameNode().getText();
    }
    // Component={Foo}
    return expr.getText();
  }
  return undefined;
}

interface ObjRoute {
  path: string;
  component?: string;
  children: string[];
}

function collectRouteObjects(arr: Node): ObjRoute[] {
  const out: ObjRoute[] = [];
  for (const el of arr.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const pathProp = el.getProperty('path');
    const indexProp = el.getProperty('index');
    let path: string | undefined;
    if (pathProp && Node.isPropertyAssignment(pathProp)) {
      const v = pathProp.getInitializer();
      if (v && Node.isStringLiteral(v)) path = v.getLiteralValue();
    } else if (indexProp) {
      path = '(index)';
    }
    if (path === undefined) continue;

    const component = componentNameFromObject(el);

    // nested children: emit each child as its own route, and record their paths
    // on the parent so the route tree is reconstructable.
    const nested: ObjRoute[] = [];
    const childrenProp = el.getProperty('children');
    if (childrenProp && Node.isPropertyAssignment(childrenProp)) {
      const v = childrenProp.getInitializer();
      if (v && Node.isArrayLiteralExpression(v)) nested.push(...collectRouteObjects(v));
    }

    out.push({ path, component, children: nested.map((c) => c.path) });
    out.push(...nested);
  }
  return out;
}

/** Component for a route object: element/Component/component, else a lazy import basename. */
function componentNameFromObject(el: Node | undefined): string | undefined {
  if (!el || !Node.isObjectLiteralExpression(el)) return undefined;
  for (const key of ['element', 'Component', 'component']) {
    const p = el.getProperty(key);
    if (p && Node.isPropertyAssignment(p)) {
      const v = p.getInitializer();
      if (!v) continue;
      if (Node.isJsxSelfClosingElement(v)) return v.getTagNameNode().getText();
      if (Node.isJsxElement(v)) return v.getOpeningElement().getTagNameNode().getText();
      return v.getText();
    }
  }
  // lazy: () => import('./Dashboard')  /  lazy: () => import('./Dashboard').then(...)
  const lazy = el.getProperty('lazy');
  if (lazy && Node.isPropertyAssignment(lazy)) {
    const imp = lazy.getInitializer()?.getFirstDescendantByKind(SyntaxKind.StringLiteral);
    if (imp) {
      const base = imp.getLiteralValue().split('/').pop()?.replace(/\.(t|j)sx?$/, '');
      if (base) return `lazy(${base})`;
    }
  }
  return undefined;
}

/* ----------------------------- TanStack helpers ------------------------- */

/** "/posts/$postId" → "/posts/:postId"; bare "$" splat → "*"; "_layout" pathless kept. */
function tanstackPathToUrl(p: string): string {
  if (!p) return '/';
  const segments = p
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg === '$') return '*';
      if (seg.startsWith('$')) return `:${seg.slice(1)}`;
      return seg;
    });
  const path = '/' + segments.join('/');
  return path === '/' ? '/' : path.replace(/\/$/, '');
}

/** Pull a route's path + component from a createRoute({...}) / new Route({...}) object arg. */
function routeFromObjectArg(arg: Node | undefined): { path: string; component?: string } | null {
  if (!arg || !Node.isObjectLiteralExpression(arg)) return null;
  const pathProp = arg.getProperty('path');
  if (!pathProp || !Node.isPropertyAssignment(pathProp)) return null;
  const v = pathProp.getInitializer();
  if (!v || !Node.isStringLiteral(v)) return null;
  return { path: tanstackPathToUrl(v.getLiteralValue()), component: componentNameFromObject(arg) };
}

/** Component from the single object-literal argument of a call, e.g. createRootRoute({ component }). */
function componentFromObjectArg(call: Node): string | undefined {
  if (!Node.isCallExpression(call)) return undefined;
  return componentNameFromObject(call.getArguments()[0]);
}

/** Component from createFileRoute('/x')({ component }) — `node` is the inner call's parent. */
function componentFromConfig(node: Node | undefined): string | undefined {
  if (!node || !Node.isCallExpression(node)) return undefined;
  return componentNameFromObject(node.getArguments()[0]);
}
