/**
 * Route extractor.
 *
 * Routing is defined by the framework's own contract:
 *   - Next.js App Router  → file role (page/layout/route/...) + directory path
 *   - Next.js Pages Router→ file path under pages/
 *   - React Router        → <Route path element> JSX, or object/data-router
 *                           config arrays (`const routes = [{ path, element,
 *                           children, lazy }]`) wherever they are declared —
 *                           inline, in a const, or in a separate file
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

// An optional monorepo workspace prefix (`apps/web/`, `packages/ui/`, …) so the
// Next `app`/`pages` dir is anchored to a project root and not matched inside an
// arbitrary source folder such as `components/app/`.
const WS_PREFIX = '(?:(?:apps|packages|services|libs|modules|examples)/[^/]+/)?';

export class RouteExtractor implements Extractor<RouteAsset> {
  name = 'route';
  produces = 'route' as const;

  /** Per-file ordinal so same-path routes (e.g. multiple index routes) get
   * distinct ids and are not collapsed by the registry's id-based dedup. */
  private seq = 0;

  extract(file: SourceFile, ctx: ExtractionContext): RouteAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const fw = ctx.frameworkOf(relPath);
    const out: RouteAsset[] = [];
    this.seq = 0;

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
    const m = relPath.match(new RegExp(`^${WS_PREFIX}(?:src/)?app/(.*)$`));
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
    const m = relPath.match(new RegExp(`^${WS_PREFIX}(?:src/)?pages/(.*)\\.(t|j)sx?$`));
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
        this.make(file, relPath, `${routePath} → ${componentName ?? '?'}`, 'react-router', routePath, 'route', ctx, componentName, [], el),
      );
    }

    // Object config (data router). Real apps rarely inline the array in the
    // `createBrowserRouter(...)` call — they declare `const routes = [...]`
    // (often in another file) and pass it by reference, e.g.
    // `createHashRouter(useLicencedRoutes(routes))`. So instead of requiring the
    // array to be a literal argument of a recognized call, detect every
    // top-level route-config array literal in the file. Each file contributes
    // the routes it defines, so a cross-file `export const routes = [...]` is
    // picked up where it lives — no import resolution required.
    const routeArrays = file
      .getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
      .filter(looksLikeRouteArray)
      .filter((arr) => !isNestedRoute(arr));
    // A single route object handed straight to a call — a project helper such
    // as `defineSection({ path, screens: [...] })` — is a route root as well.
    const routeObjects = file
      .getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
      .filter((obj) => isRouteHelperArg(obj) && looksLikeRouteObject(obj))
      .filter((obj) => !isNestedRoute(obj));
    const roots = [...routeArrays, ...routeObjects].sort((a, b) => a.getStart() - b.getStart());
    for (const root of roots) {
      const routes = Node.isArrayLiteralExpression(root) ? collectRouteObjects(root) : collectRouteObject(root);
      for (const r of routes) {
        out.push(
          this.make(file, relPath, `${r.path} → ${r.component ?? '?'}`, 'react-router', r.path, 'route', ctx, r.component, r.children, r.node),
        );
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
    node: Node = file,
  ): RouteAsset {
    return {
      id: makeId(relPath, `route:${routePath}:${router}:${componentName ?? ''}#${this.seq++}`),
      name,
      type: 'route',
      path: relPath,
      exportType: 'none',
      location: location(node, relPath),
      jsDoc: getLeadingJsDoc(node),
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
    // element={<Foo/>} or a wrapped tree element={<Layout><Foo/></Layout>}
    const name = jsxComponentName(expr);
    if (name) return name;
    // Component={Foo}
    return expr.getText();
  }
  return undefined;
}

/** TanStack's own route factories — handled by `tanstackRoutes`. */
const TANSTACK_FACTORIES = new Set(['createRoute', 'createRootRoute', 'createRootRouteWithContext', 'createFileRoute', 'createLazyFileRoute']);

/** An object literal passed to a (non-TanStack) call, e.g. `defineSection({ … })`. */
function isRouteHelperArg(obj: Node): boolean {
  const call = obj.getParent();
  if (!call || !Node.isCallExpression(call)) return false;
  const callee = call.getExpression().getText();
  return !TANSTACK_FACTORIES.has(callee.split('.').pop() ?? callee);
}

interface ObjRoute {
  path: string;
  component?: string;
  children: string[];
  node: Node;
}

// Keys that mark an object literal as a react-router route config (rather than,
// say, a nav-menu item that merely has a `path`). Requiring one of these avoids
// false positives from arbitrary `{ path, label }` config arrays.
const ROUTE_OBJECT_KEYS = [
  'element',
  'Component',
  'component',
  'children',
  'lazy',
  'loader',
  'action',
  'handle',
  'errorElement',
  'ErrorBoundary',
];

function looksLikeRouteObject(obj: Node): boolean {
  if (!Node.isObjectLiteralExpression(obj)) return false;
  const hasPathish = !!obj.getProperty('path') || !!obj.getProperty('index');
  const hasRouteKey = ROUTE_OBJECT_KEYS.some((k) => !!obj.getProperty(k));
  if (hasPathish && hasRouteKey) return true;
  // Nested routes may live under `children` or a project-specific key such as
  // `screens`; a child array of route objects marks this object as a route.
  // Without a path it's a pathless layout route.
  return childRouteArrays(obj).length > 0;
}

/** Array-valued properties of a route object that hold child route objects. */
function childRouteArrays(obj: Node): Node[] {
  if (!Node.isObjectLiteralExpression(obj)) return [];
  const out: Node[] = [];
  for (const p of obj.getProperties()) {
    if (!Node.isPropertyAssignment(p)) continue;
    const v = p.getInitializer();
    if (v && Node.isArrayLiteralExpression(v) && looksLikeRouteArray(v)) out.push(v);
  }
  return out;
}

/**
 * The object literals an array contributes, flattening spreads of inline
 * arrays — including feature-flagged ones like `...(flag ? [{…}] : [])`.
 */
function arrayObjects(arr: Node): Node[] {
  const out: Node[] = [];
  const visit = (n: Node | undefined): void => {
    if (!n) return;
    if (Node.isParenthesizedExpression(n)) return visit(n.getExpression());
    if (Node.isConditionalExpression(n)) {
      visit(n.getWhenTrue());
      visit(n.getWhenFalse());
      return;
    }
    if (Node.isArrayLiteralExpression(n)) {
      for (const el of n.getElements()) {
        if (Node.isObjectLiteralExpression(el)) out.push(el);
        else if (Node.isSpreadElement(el)) visit(el.getExpression());
      }
    }
  };
  visit(arr);
  return out;
}

/** True if the array literal contains at least one react-router route object. */
function looksLikeRouteArray(arr: Node): boolean {
  return arrayObjects(arr).some(looksLikeRouteObject);
}

/** True if this node sits inside another route array or route object, so it is
 *  already handled by that root's recursive collection. */
function isNestedRoute(node: Node): boolean {
  let p = node.getParent();
  while (p) {
    if (Node.isArrayLiteralExpression(p) && looksLikeRouteArray(p)) return true;
    if (Node.isObjectLiteralExpression(p) && looksLikeRouteObject(p)) return true;
    p = p.getParent();
  }
  return false;
}

function collectRouteObjects(arr: Node): ObjRoute[] {
  return arrayObjects(arr).flatMap(collectRouteObject);
}

function collectRouteObject(el: Node): ObjRoute[] {
  const out: ObjRoute[] = [];
  if (!Node.isObjectLiteralExpression(el)) return out;
  const pathProp = el.getProperty('path');
  const indexProp = el.getProperty('index');
  let path: string | undefined;
  if (pathProp && Node.isPropertyAssignment(pathProp)) {
    const v = pathProp.getInitializer();
    if (v && Node.isStringLiteral(v)) path = v.getLiteralValue();
  }
  // `{ index: true }` (with or without an empty `path: ''`) is an index route.
  if ((path === undefined || path === '') && indexProp) path = '(index)';

  const component = componentNameFromObject(el);

  // nested children: emit each child as its own route, and record their paths
  // on the parent so the route tree is reconstructable.
  const nested = childRouteArrays(el).flatMap(collectRouteObjects);

  if (path === undefined) {
    // Pathless layout route (e.g. an auth/error layout wrapper). Surface it
    // only when it actually wraps something, and keep its children so the
    // nested paths are not lost.
    if (component || nested.length) {
      out.push({ path: '(layout)', component, children: nested.map((c) => c.path), node: el });
      out.push(...nested);
    }
    return out;
  }

  out.push({ path, component, children: nested.map((c) => c.path), node: el });
  out.push(...nested);
  return out;
}

/**
 * Pick the meaningful component name from a route `element` value, which is
 * often a wrapped tree like `(<Layout><ErrorBoundary><Page/></ErrorBoundary></Layout>)`.
 * We take the innermost PascalCase JSX tag (the page) rather than dumping the
 * whole JSX expression or returning a generic wrapper / host element.
 */
function jsxComponentName(node: Node): string | undefined {
  let n = node;
  while (Node.isParenthesizedExpression(n)) n = n.getExpression() ?? n;

  const tags: string[] = [];
  if (Node.isJsxSelfClosingElement(n)) tags.push(n.getTagNameNode().getText());
  else if (Node.isJsxElement(n)) tags.push(n.getOpeningElement().getTagNameNode().getText());
  const root = n;
  // JSX passed as a prop (`icon={<HomeOutlined/>}`) is decoration, not the page.
  const inProp = (d: Node): boolean =>
    d.getAncestors().some((a) => Node.isJsxAttribute(a) && a.getStart() >= root.getStart() && a.getEnd() <= root.getEnd());
  for (const d of n.getDescendants()) {
    if ((Node.isJsxOpeningElement(d) || Node.isJsxSelfClosingElement(d)) && !inProp(d)) {
      tags.push(d.getTagNameNode().getText());
    }
  }
  if (tags.length === 0) return undefined;

  const isPascal = (t: string) => /^[A-Z]/.test(t.split('.').pop() ?? t);
  const pascal = tags.filter(isPascal);
  // innermost (last in document order) component, else the first tag (host elem)
  return pascal.length ? pascal[pascal.length - 1] : tags[0];
}

/** Component for a route object: element/Component/component, else a lazy import basename. */
function componentNameFromObject(el: Node | undefined): string | undefined {
  if (!el || !Node.isObjectLiteralExpression(el)) return undefined;
  for (const key of ['element', 'Component', 'component']) {
    const p = el.getProperty(key);
    if (p && Node.isPropertyAssignment(p)) {
      const v = p.getInitializer();
      if (!v) continue;
      const name = jsxComponentName(v);
      if (name) return name;
      if (Node.isIdentifier(v)) return v.getText();
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
