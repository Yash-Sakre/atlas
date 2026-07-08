/**
 * Path-alias discovery for module resolution.
 *
 * ts-morph resolves imports through the TypeScript module resolver, which honours
 * `paths`/`baseUrl` from tsconfig. But many Vite/Webpack projects declare their
 * aliases (`@/*` → `src/*`) ONLY in `vite.config.ts` / `webpack.config.js`, not
 * in tsconfig. Without those, every `import … from '@/…'` fails to resolve, so
 * cross-file usage is never counted and the target shows up as dead code.
 *
 * This module parses those build-config aliases (statically, via AST — the config
 * is never executed) and turns them into tsconfig-style `paths` entries that we
 * feed into the ts-morph Project so alias imports resolve like everything else.
 */
import { existsSync } from 'fs';
import { relative } from 'path';
import { Node, Project, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';

const VITE_CONFIGS = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts', 'vite.config.cts', 'vite.config.cjs'];

/**
 * Discover build-tool path aliases under `root` and return them as tsconfig-style
 * `paths` entries (relative to `root`, which callers should use as `baseUrl`).
 * Returns an empty object when nothing is found.
 */
export function readBuildAliases(root: string): Record<string, string[]> {
  const paths: Record<string, string[]> = {};

  for (const name of VITE_CONFIGS) {
    const abs = joinRoot(root, name);
    if (!existsSync(abs)) continue;
    try {
      collectViteAliases(abs, root, paths);
    } catch {
      /* unparseable config → skip, best-effort only */
    }
    break; // one vite config per project
  }

  return paths;
}

function joinRoot(root: string, name: string): string {
  return root.endsWith('/') ? `${root}${name}` : `${root}/${name}`;
}

/** Parse a vite config's `resolve.alias` (object or array form) into `paths`. */
function collectViteAliases(configPath: string, root: string, out: Record<string, string[]>): void {
  // Parse the config in an isolated in-memory project — never executed, just read.
  const scratch = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true } });
  const sf = scratch.addSourceFileAtPath(configPath);

  // Find every `alias:` property (there is normally one, under `resolve`).
  for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (aliasKey(prop.getNameNode()) !== 'alias') continue;
    const init = prop.getInitializerOrThrow();
    if (Node.isObjectLiteralExpression(init)) collectFromObject(init, root, out);
    else if (Node.isArrayLiteralExpression(init)) collectFromArray(init, root, out);
  }
}

/** `{ '@': '/abs/src', '@ui': path.resolve(__dirname, 'src/ui') }` */
function collectFromObject(obj: ObjectLiteralExpression, root: string, out: Record<string, string[]>): void {
  for (const p of obj.getProperties()) {
    if (!Node.isPropertyAssignment(p)) continue;
    const key = aliasKey(p.getNameNode());
    if (!key) continue;
    const target = resolveTarget(p.getInitializer(), root);
    if (target != null) addAlias(key, target, out);
  }
}

/** `[{ find: '@', replacement: '/abs/src' }]` */
function collectFromArray(arr: import('ts-morph').ArrayLiteralExpression, root: string, out: Record<string, string[]>): void {
  for (const el of arr.getElements()) {
    if (!Node.isObjectLiteralExpression(el)) continue;
    let find: string | undefined;
    let replacement: Node | undefined;
    for (const p of el.getProperties()) {
      if (!Node.isPropertyAssignment(p)) continue;
      const name = aliasKey(p.getNameNode());
      if (name === 'find') find = literalString(p.getInitializer());
      else if (name === 'replacement') replacement = p.getInitializer();
    }
    if (find == null) continue;
    const target = resolveTarget(replacement, root);
    if (target != null) addAlias(find, target, out);
  }
}

/**
 * Turn an alias key + its resolved directory (relative to root) into `paths`
 * entries. `@` mapping to `src` yields both `@/*` → `src/*` (prefix imports) and
 * `@` → `src` (bare/exact imports), mirroring Vite's prefix-matching semantics.
 */
function addAlias(key: string, relDir: string, out: Record<string, string[]>): void {
  const cleanKey = key.replace(/\/\*?$/, ''); // '@/' or '@/*' → '@'
  const cleanDir = relDir.replace(/\/$/, '').replace(/^\.\//, '') || '.';
  if (!out[`${cleanKey}/*`]) out[`${cleanKey}/*`] = [`${cleanDir}/*`];
  if (!out[cleanKey]) out[cleanKey] = [cleanDir === '.' ? '.' : cleanDir];
}

/** The literal name of a property (string literal or identifier). */
function aliasKey(nameNode: Node): string | undefined {
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) return nameNode.getLiteralText();
  if (Node.isIdentifier(nameNode)) return nameNode.getText();
  return undefined;
}

function literalString(node: Node | undefined): string | undefined {
  if (node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))) return node.getLiteralText();
  return undefined;
}

/**
 * Resolve an alias target expression to a directory relative to `root`.
 * Handles: string literals, `path.resolve/join(__dirname, '…')`,
 * `fileURLToPath(new URL('…', import.meta.url))`, and `new URL('…', …).pathname`.
 * Returns null when no static path can be recovered.
 */
function resolveTarget(node: Node | undefined, root: string): string | null {
  if (!node) return null;

  const direct = literalString(node);
  if (direct != null) return toRel(direct, root);

  // path.resolve(__dirname, 'src') / path.join(...) → last string argument.
  if (Node.isCallExpression(node)) {
    const strings = node.getArguments().map(literalString).filter((s): s is string => s != null);
    if (strings.length) return toRel(strings[strings.length - 1], root);
    // fileURLToPath(new URL('./src', import.meta.url)) → recurse into args.
    for (const arg of node.getArguments()) {
      const nested = resolveTarget(arg, root);
      if (nested != null) return nested;
    }
  }

  // new URL('./src', import.meta.url)
  if (Node.isNewExpression(node)) {
    const first = node.getArguments()[0];
    const s = literalString(first);
    if (s != null) return toRel(s, root);
  }

  // fall back to the first string literal anywhere inside (e.g. template pieces).
  for (const d of node.getDescendantsOfKind(SyntaxKind.StringLiteral)) return toRel(d.getLiteralText(), root);
  return null;
}

/**
 * Normalise a target (absolute, `./relative`, or `/src`-style Vite root path) to a
 * path relative to `root` with forward slashes.
 */
function toRel(target: string, root: string): string {
  let t = target;
  // Vite treats a leading '/' as project-root-relative, not filesystem-absolute.
  if (t.startsWith('/') && !existsSync(t)) t = t.slice(1);
  const abs = t.startsWith('/') ? t : `${root}/${t.replace(/^\.\//, '')}`;
  return relative(root, abs).replace(/\\/g, '/') || '.';
}
