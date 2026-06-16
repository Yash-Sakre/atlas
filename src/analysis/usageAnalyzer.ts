/**
 * Usage analysis.
 *
 * Resolves cross-file (and intra-file) references for every discovered asset by
 * binding import specifiers to their target asset, then walking identifier /
 * JSX / call references. Mutates each asset's `usedIn`, `usageCount`, and
 * `dependencies`. Uses the TS module resolver (not string matching) so aliases
 * and re-exports resolve correctly.
 */
import { Node, SyntaxKind, type Identifier, type SourceFile } from 'ts-morph';
import type { Asset, ExtractionContext, UsageReference } from '../core/types';
import { rel } from '../core/project';
import { makeId } from '../extractors/ast-utils';

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

export function analyzeUsage(assets: Asset[], ctx: ExtractionContext): void {
  // Reset accumulators so re-runs (and cache-restored assets) don't double-count.
  for (const a of assets) {
    a.usedIn = [];
    a.dependencies = [];
    a.usageCount = 0;
  }

  const byId = new Map<string, Asset>();
  const byFileName = new Map<string, string>(); // `${relPath}::${name}` → id
  const defaultByFile = new Map<string, string>(); // relPath → id of default export

  for (const a of assets) {
    byId.set(a.id, a);
    byFileName.set(`${a.path}::${a.name}`, a.id);
    if ('exportType' in a && a.exportType === 'default') defaultByFile.set(a.path, a.id);
  }

  // dependency sets keyed by asset id (de-duped)
  const deps = new Map<string, Set<string>>();
  for (const a of assets) deps.set(a.id, new Set());

  for (const file of ctx.sourceFiles) {
    const relF = rel(ctx.root, file.getFilePath());
    const bindings = buildBindings(file, ctx, relF, byFileName, defaultByFile);
    if (bindings.size === 0) continue;

    // Map of local asset name → id, for enclosing-asset attribution.
    const localAssetByName = new Map<string, string>();
    for (const a of assets) {
      if (a.path === relF) localAssetByName.set(a.name, a.id);
    }

    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const targetId = bindings.get(id.getText());
      if (!targetId) continue;
      const parent = id.getParent();
      if (parent && DECL_PARENT_KINDS.has(parent.getKind()) && isNamePosition(id, parent)) continue;
      // Skip the property name of `a.b` access (only the object matters).
      if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue;

      const target = byId.get(targetId);
      if (!target) continue;

      const ref: UsageReference = {
        filePath: relF,
        line: id.getStartLineNumber(),
        kind: classifyRef(id),
      };
      target.usedIn.push(ref);

      // Attribute a dependency edge from the enclosing asset to the target.
      const enclosingId = enclosingAssetId(id, localAssetByName);
      if (enclosingId && enclosingId !== targetId) {
        deps.get(enclosingId)?.add(targetId);
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
}

/** local identifier text → target asset id (imports + own-file assets). */
function buildBindings(
  file: SourceFile,
  ctx: ExtractionContext,
  relF: string,
  byFileName: Map<string, string>,
  defaultByFile: Map<string, string>,
): Map<string, string> {
  const bindings = new Map<string, string>();

  // Own-file assets (captures intra-file usage like a sibling component).
  for (const [key, id] of byFileName) {
    if (key.startsWith(`${relF}::`)) {
      bindings.set(key.slice(relF.length + 2), id);
    }
  }

  for (const imp of file.getImportDeclarations()) {
    let targetRel: string | undefined;
    try {
      const tf = imp.getModuleSpecifierSourceFile();
      if (tf) targetRel = rel(ctx.root, tf.getFilePath());
    } catch {
      /* unresolved */
    }
    if (!targetRel) continue;

    for (const named of imp.getNamedImports()) {
      const importedName = named.getName();
      const local = named.getAliasNode()?.getText() ?? importedName;
      const id = byFileName.get(`${targetRel}::${importedName}`);
      if (id) bindings.set(local, id);
    }
    const def = imp.getDefaultImport();
    if (def) {
      const id = defaultByFile.get(targetRel);
      if (id) bindings.set(def.getText(), id);
    }
  }

  return bindings;
}

function isNamePosition(id: Identifier, parent: Node): boolean {
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

function classifyRef(id: Identifier): UsageReference['kind'] {
  let n: Node | undefined = id;
  for (let i = 0; i < 3 && n; i++) {
    const k = n.getKind();
    if (k === SyntaxKind.JsxOpeningElement || k === SyntaxKind.JsxSelfClosingElement) return 'jsx';
    n = n.getParent();
  }
  const parent = id.getParent();
  if (parent && Node.isCallExpression(parent) && parent.getExpression() === id) return 'call';
  return 'reference';
}

function enclosingAssetId(id: Identifier, localAssetByName: Map<string, string>): string | undefined {
  for (const anc of id.getAncestors()) {
    let name: string | undefined;
    if (Node.isFunctionDeclaration(anc) || Node.isClassDeclaration(anc)) name = anc.getName();
    else if (Node.isVariableDeclaration(anc)) name = anc.getName();
    if (name && localAssetByName.has(name)) return localAssetByName.get(name);
  }
  return undefined;
}
