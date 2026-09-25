/**
 * Usage analysis.
 *
 * Resolves cross-file (and intra-file) references for every discovered asset by
 * binding import specifiers to their target asset, then walking identifier /
 * JSX / call references. Mutates each asset's `usedIn`, `usageCount`, and
 * `dependencies`. Uses the TS module resolver (not string matching) so aliases
 * and re-exports resolve correctly.
 *
 * Both static imports and dynamic loads (`await import()`, `React.lazy()`,
 * `next/dynamic`, `require()`) are bound — see `moduleRefs`.
 */
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import type { Asset, ExtractionContext, UsageReference } from '../core/types';
import { rel } from '../core/project';
import { getName } from '../extractors/ast-utils';
import { collectDynamicModuleRefs, resolveModuleFile } from './moduleRefs';

const DECL_PARENT_KINDS = new Set<SyntaxKind>([
  SyntaxKind.ImportSpecifier,
  SyntaxKind.ImportClause,
  SyntaxKind.NamespaceImport,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.ClassDeclaration,
  SyntaxKind.VariableDeclaration,
  SyntaxKind.BindingElement,
  SyntaxKind.PropertyAssignment,
  SyntaxKind.PropertySignature,
]);

export interface UsageResult {
  /**
   * Files that export something another file imports but that isn't an asset
   * (a constant, a config object, a type). Those imports can't be counted, so
   * such files must never be reported as orphans.
   */
  untrackedImportTargets: Set<string>;
}

export function analyzeUsage(assets: Asset[], ctx: ExtractionContext): UsageResult {
  // Reset accumulators so re-runs (and cache-restored assets) don't double-count.
  for (const a of assets) {
    a.usedIn = [];
    a.dependencies = [];
    a.usageCount = 0;
  }

  const byId = new Map<string, Asset>();
  const byFileName = new Map<string, string>(); // `${relPath}::${name}` → id
  const defaultByFile = new Map<string, string>(); // relPath → id of default export
  const idsByFile = new Map<string, string[]>(); // relPath → every asset id in it

  for (const a of assets) {
    byId.set(a.id, a);
    byFileName.set(`${a.path}::${a.name}`, a.id);
    if ('exportType' in a && a.exportType === 'default') defaultByFile.set(a.path, a.id);
    const inFile = idsByFile.get(a.path) ?? [];
    inFile.push(a.id);
    idsByFile.set(a.path, inFile);
  }

  const untrackedImportTargets = new Set<string>();

  // dependency sets keyed by asset id (de-duped)
  const deps = new Map<string, Set<string>>();
  for (const a of assets) deps.set(a.id, new Set());

  for (const file of ctx.sourceFiles) {
    const relF = rel(ctx.root, file.getFilePath());
    const { bindings, namespaces, direct, loads } = buildBindings(
      file,
      ctx,
      relF,
      byFileName,
      defaultByFile,
      untrackedImportTargets,
    );
    if (bindings.size === 0 && namespaces.size === 0 && direct.length === 0 && loads.length === 0) {
      continue;
    }

    // Map of local asset name → id, for enclosing-asset attribution.
    const localAssetByName = new Map<string, string>();
    for (const a of assets) {
      if (a.path === relF) localAssetByName.set(a.name, a.id);
    }

    // Record a reference to `targetId` whose location/kind come from `refNode`.
    const record = (targetId: string, refNode: Node, kind?: UsageReference['kind']): void => {
      const target = byId.get(targetId);
      if (!target) return;
      target.usedIn.push({
        filePath: relF,
        line: refNode.getStartLineNumber(),
        kind: kind ?? classifyRef(refNode),
      });
      const enclosingId = enclosingAssetId(refNode, localAssetByName);
      if (enclosingId && enclosingId !== targetId) deps.get(enclosingId)?.add(targetId);
    };

    // `(await import('m')).foo` — no local name, so record the read directly.
    for (const d of direct) record(d.id, d.node);

    // A dynamic load that binds nothing (`lazy: () => import('./Panel')`, a bare
    // `await import('./polyfill')`) still makes every export in that module
    // reachable — enough to keep it out of the dead-code report.
    for (const l of loads) {
      for (const id of idsByFile.get(l.targetRel) ?? []) record(id, l.node, 'import');
    }

    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const text = id.getText();
      const parent = id.getParent();

      const targetId = bindings.get(text);
      if (targetId) {
        if (parent && DECL_PARENT_KINDS.has(parent.getKind()) && isNamePosition(id, parent)) continue;
        // Skip the property name of `a.b` access (only the object matters).
        if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue;
        // `export default X` / `export { X }` publish a name; they don't use it.
        if (parent && (Node.isExportAssignment(parent) || Node.isExportSpecifier(parent))) continue;
        record(targetId, id);
        continue;
      }

      // Namespace member access: `import * as NS from 'm'; NS.useFoo()`.
      const ns = namespaces.get(text);
      if (ns && parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === id) {
        const member = parent.getNameNode().getText();
        const memberId =
          byFileName.get(`${ns.targetRel}::${member}`) ?? resolveReExport(ns.file, member, ctx, byFileName);
        if (memberId) record(memberId, parent);
      }
    }
  }

  for (const a of assets) {
    // de-dup usedIn by file+line+kind
    const seen = new Set<string>();
    a.usedIn = a.usedIn.filter((r) => {
      const k = `${r.filePath}:${r.line}:${r.kind}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    a.usageCount = a.usedIn.length;
    a.dependencies = [...(deps.get(a.id) ?? [])];
  }
  return { untrackedImportTargets };
}

interface FileBindings {
  /** local identifier text → target asset id (imports + own-file assets). */
  bindings: Map<string, string>;
  /** local namespace name → resolved module, for `import * as NS` member access. */
  namespaces: Map<string, { file: SourceFile; targetRel: string }>;
  /** References with no local name, e.g. `(await import('m')).foo`. */
  direct: Array<{ id: string; node: Node }>;
  /** Dynamic loads that bound nothing — the whole module is still reachable. */
  loads: Array<{ targetRel: string; node: Node }>;
}

function buildBindings(
  file: SourceFile,
  ctx: ExtractionContext,
  relF: string,
  byFileName: Map<string, string>,
  defaultByFile: Map<string, string>,
  untrackedImportTargets: Set<string>,
): FileBindings {
  const bindings = new Map<string, string>();
  const namespaces = new Map<string, { file: SourceFile; targetRel: string }>();
  const direct: Array<{ id: string; node: Node }> = [];
  const loads: Array<{ targetRel: string; node: Node }> = [];

  // Own-file assets (captures intra-file usage like a sibling component).
  for (const [key, id] of byFileName) {
    if (key.startsWith(`${relF}::`)) {
      bindings.set(key.slice(relF.length + 2), id);
    }
  }

  for (const imp of file.getImportDeclarations()) {
    let tf: SourceFile | undefined;
    let targetRel: string | undefined;
    try {
      tf = imp.getModuleSpecifierSourceFile();
      if (tf) targetRel = rel(ctx.root, tf.getFilePath());
    } catch {
      /* unresolved */
    }
    if (!tf || !targetRel) continue;

    for (const named of imp.getNamedImports()) {
      const importedName = named.getName();
      const local = named.getAliasNode()?.getText() ?? importedName;
      // Direct: the name is defined in the resolved module.
      let id = byFileName.get(`${targetRel}::${importedName}`);
      // Fallback: the module re-exports it (barrel / `export … from`). Follow
      // the chain to the file where it is actually declared.
      if (!id) id = resolveReExport(tf, importedName, ctx, byFileName);
      if (id) bindings.set(local, id);
      else markUntracked(tf, importedName, ctx, untrackedImportTargets);
    }
    const def = imp.getDefaultImport();
    if (def) {
      const id = defaultByFile.get(targetRel) ?? resolveReExport(tf, 'default', ctx, byFileName);
      if (id) bindings.set(def.getText(), id);
      else markUntracked(tf, 'default', ctx, untrackedImportTargets);
    }
    // `import * as NS from 'm'` — usage shows up later as `NS.member`.
    const ns = imp.getNamespaceImport();
    if (ns) {
      namespaces.set(ns.getText(), { file: tf, targetRel });
      untrackedImportTargets.add(targetRel);
    }
  }

  // Dynamic loads: `await import()`, `lazy(() => import())`, `require()`, …
  for (const ref of collectDynamicModuleRefs(file)) {
    const tf = resolveModuleFile(file, ref.specNode);
    if (!tf) continue;
    const targetRel = rel(ctx.root, tf.getFilePath());

    // Resolve an exported name in the target module, following barrels.
    const exportId = (name: string): string | undefined =>
      name === 'default'
        ? (defaultByFile.get(targetRel) ?? resolveReExport(tf, 'default', ctx, byFileName))
        : (byFileName.get(`${targetRel}::${name}`) ?? resolveReExport(tf, name, ctx, byFileName));

    let bound = false;
    for (const b of ref.bindings) {
      if (b.kind === 'namespace') {
        namespaces.set(b.local, { file: tf, targetRel });
        bound = true;
        continue;
      }
      const id = exportId(b.kind === 'default' ? 'default' : (b.imported ?? b.local));
      if (id) {
        bindings.set(b.local, id);
        bound = true;
      }
    }
    for (const m of ref.members) {
      const id = exportId(m.name);
      if (id) {
        direct.push({ id, node: m.node });
        bound = true;
      }
    }
    if (!bound) loads.push({ targetRel, node: ref.site });
  }

  return { bindings, namespaces, direct, loads };
}

/**
 * Resolve `name` exported from `file` to the asset id of its real declaration,
 * following re-export chains (barrel `index.ts` files). `getExportedDeclarations`
 * does the transitive resolution; we map each declaration back to an asset by
 * its source file + declared name.
 */
function resolveReExport(
  file: SourceFile,
  name: string,
  ctx: ExtractionContext,
  byFileName: Map<string, string>,
): string | undefined {
  let decls;
  try {
    decls = file.getExportedDeclarations().get(name);
  } catch {
    return undefined;
  }
  if (!decls) return undefined;
  for (const decl of decls) {
    const declName = getName(decl);
    if (!declName) continue;
    const declRel = rel(ctx.root, decl.getSourceFile().getFilePath());
    const id = byFileName.get(`${declRel}::${declName}`);
    if (id) return id;
  }
  return undefined;
}

/** Record the file(s) that actually declare `name` exported from `file`. */
function markUntracked(file: SourceFile, name: string, ctx: ExtractionContext, out: Set<string>): void {
  let decls: Node[] | undefined;
  try {
    decls = file.getExportedDeclarations().get(name);
  } catch {
    /* unresolvable */
  }
  if (!decls?.length) {
    out.add(rel(ctx.root, file.getFilePath()));
    return;
  }
  for (const d of decls) out.add(rel(ctx.root, d.getSourceFile().getFilePath()));
}

function isNamePosition(id: Node, parent: Node): boolean {
  const named = parent as unknown as { getNameNode?: () => Node };
  if (typeof named.getNameNode === 'function') {
    try {
      return named.getNameNode() === id;
    } catch {
      return false;
    }
  }
  return true;
}

function classifyRef(node: Node): UsageReference['kind'] {
  let n: Node | undefined = node;
  for (let i = 0; i < 3 && n; i++) {
    const k = n.getKind();
    if (k === SyntaxKind.JsxOpeningElement || k === SyntaxKind.JsxSelfClosingElement) return 'jsx';
    n = n.getParent();
  }
  const parent = node.getParent();
  if (parent && Node.isCallExpression(parent) && parent.getExpression() === node) return 'call';
  return 'reference';
}

function enclosingAssetId(node: Node, localAssetByName: Map<string, string>): string | undefined {
  for (const anc of node.getAncestors()) {
    let name: string | undefined;
    if (Node.isFunctionDeclaration(anc) || Node.isClassDeclaration(anc)) name = anc.getName();
    else if (Node.isVariableDeclaration(anc)) name = anc.getName();
    if (name && localAssetByName.has(name)) return localAssetByName.get(name);
  }
  return undefined;
}
