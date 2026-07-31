/**
 * Module reference collection.
 *
 * `SourceFile.getImportDeclarations()` only sees *static* `import` statements, so
 * anything loaded lazily — `await import('./x')`, `React.lazy(() => import('./x'))`,
 * `next/dynamic`, `require('./x')`, `import x = require('./x')` — is invisible to
 * usage analysis and gets falsely reported as dead code.
 *
 * This module walks those call forms and reports, per load site:
 *   - the local names the module (or its exports) is bound to,
 *   - members read straight off the module object,
 * so the usage analyzer can bind them exactly like static imports.
 */
import {
  Node,
  SyntaxKind,
  ts,
  type CallExpression,
  type SourceFile,
  type StringLiteral,
} from 'ts-morph';

/** A local name bound to some part of a dynamically loaded module. */
export interface ImportBinding {
  /** Local identifier in the consuming file. */
  local: string;
  kind: 'named' | 'default' | 'namespace';
  /** Exported name when `kind === 'named'`. */
  imported?: string;
}

/** `(await import('m')).foo` — an export read directly off the module object. */
export interface MemberRead {
  name: string;
  /** Node the reference is attributed to (location + kind). */
  node: Node;
}

export interface DynamicModuleRef {
  spec: string;
  specNode: StringLiteral;
  syntax: 'import' | 'require';
  bindings: ImportBinding[];
  members: MemberRead[];
  /** The load site, used when nothing else binds (e.g. `lazy: () => import('./X')`). */
  site: Node;
  /** Export standing in for `default` in a `.then(m => ({ default: m.X }))` chain. */
  defaultAlias?: string;
}

/** Expressions that pass the module value through unchanged. */
const PASSTHROUGH_KINDS = new Set<SyntaxKind>([
  SyntaxKind.AwaitExpression,
  SyntaxKind.ParenthesizedExpression,
  SyntaxKind.AsExpression,
  SyntaxKind.NonNullExpression,
  SyntaxKind.TypeAssertionExpression,
  SyntaxKind.SatisfiesExpression,
]);

/** Cheap text gate — most files contain no dynamic load at all. */
const DYNAMIC_HINT = /\bimport\s*\(|\brequire\s*\(|=\s*require\b/;

/**
 * Every module specifier the file references, in any syntax: static imports,
 * `export … from`, `import x = require()`, `import()` and `require()` calls.
 * Used for third-party dependency usage counting.
 */
export function collectModuleSpecifiers(file: SourceFile): string[] {
  const specs: string[] = [];
  for (const imp of file.getImportDeclarations()) specs.push(imp.getModuleSpecifierValue());
  for (const exp of file.getExportDeclarations()) {
    const v = exp.getModuleSpecifierValue();
    if (v) specs.push(v);
  }
  for (const eq of file.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    const lit = importEqualsSpecifier(eq);
    if (lit) specs.push(lit.getLiteralValue());
  }
  for (const { specNode } of collectDynamicModuleRefs(file)) specs.push(specNode.getLiteralValue());
  return specs;
}

/** All dynamic (`import()` / `require()`) module loads in a file, with their bindings. */
export function collectDynamicModuleRefs(file: SourceFile): DynamicModuleRef[] {
  if (!DYNAMIC_HINT.test(file.getFullText())) return [];

  const refs: DynamicModuleRef[] = [];

  for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const syntax = loadSyntax(call);
    if (!syntax) continue;
    const arg = call.getArguments()[0];
    if (!arg || !Node.isStringLiteral(arg)) continue; // computed specifier — unresolvable

    const ref: DynamicModuleRef = {
      spec: arg.getLiteralValue(),
      specNode: arg,
      syntax,
      bindings: [],
      members: [],
      site: call,
    };
    consume(climbValue(call), ref, 0);
    refs.push(ref);
  }

  // Type positions: `type P = import('./m').Props`, `typeof import('./m')`.
  for (const node of file.getDescendantsOfKind(SyntaxKind.ImportType)) {
    const literal = node.getArgument().asKind(SyntaxKind.LiteralType)?.getLiteral();
    if (!literal || !Node.isStringLiteral(literal)) continue;
    const qualifier = node.getQualifier();
    const member = qualifier ? leftmostName(qualifier) : undefined;
    refs.push({
      spec: literal.getLiteralValue(),
      specNode: literal,
      syntax: 'import',
      bindings: [],
      members: member ? [{ name: member.getText(), node: member }] : [],
      site: node,
    });
  }

  // `import x = require('./x')` — bind `x` as a namespace.
  for (const eq of file.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    const lit = importEqualsSpecifier(eq);
    if (!lit) continue;
    refs.push({
      spec: lit.getLiteralValue(),
      specNode: lit,
      syntax: 'require',
      bindings: [{ local: eq.getName(), kind: 'namespace' }],
      members: [],
      site: eq,
    });
  }

  return refs;
}

/**
 * Resolve a module specifier to a project source file. The type checker handles
 * `import()` (including tsconfig `paths` and package `exports`); `require()`
 * specifiers carry no symbol, so those fall back to the module resolver.
 */
export function resolveModuleFile(file: SourceFile, specNode: StringLiteral): SourceFile | undefined {
  const project = file.getProject();
  try {
    const decl = project.getTypeChecker().getSymbolAtLocation(specNode)?.getDeclarations()?.[0];
    if (decl) return decl.getSourceFile();
  } catch {
    /* unresolved — fall through */
  }
  try {
    const resolved = ts.resolveModuleName(
      specNode.getLiteralValue(),
      file.getFilePath(),
      project.compilerOptions.get(),
      project.getModuleResolutionHost(),
    ).resolvedModule?.resolvedFileName;
    if (resolved) return project.getSourceFile(resolved);
  } catch {
    /* unresolved */
  }
  return undefined;
}

/* --------------------------------- internals ----------------------------- */

function loadSyntax(call: CallExpression): DynamicModuleRef['syntax'] | undefined {
  const expr = call.getExpression();
  if (expr.getKind() === SyntaxKind.ImportKeyword) return 'import';
  if (Node.isIdentifier(expr) && expr.getText() === 'require') return 'require';
  return undefined;
}

function importEqualsSpecifier(eq: Node): StringLiteral | undefined {
  if (!Node.isImportEqualsDeclaration(eq)) return undefined;
  const ref = eq.getModuleReference();
  if (!Node.isExternalModuleReference(ref)) return undefined;
  const expr = ref.getExpression();
  return expr && Node.isStringLiteral(expr) ? expr : undefined;
}

/** `NS.Inner.Type` → the `NS` identifier (the actual module export). */
function leftmostName(entity: Node): Node {
  let cur = entity;
  while (Node.isQualifiedName(cur)) cur = cur.getLeft();
  return cur;
}

/** Walk up past `await` / parens / `as T` so we land on the real consumer. */
function climbValue(node: Node): Node {
  let cur = node;
  for (let i = 0; i < 8; i++) {
    const parent = cur.getParent();
    if (!parent || !PASSTHROUGH_KINDS.has(parent.getKind())) return cur;
    const inner = (parent as unknown as { getExpression?: () => Node }).getExpression?.();
    if (inner !== cur) return cur;
    cur = parent;
  }
  return cur;
}

/** Interpret whatever the module value flows into. */
function consume(value: Node, ref: DynamicModuleRef, depth: number): void {
  if (depth > 6) return;
  const parent = value.getParent();
  if (!parent) return;

  // const m = await import('m')  /  const { a } = await import('m')
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === value) {
    bindTarget(parent.getNameNode(), ref);
    return;
  }

  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === value) {
    const name = parent.getName();
    const call = parent.getParent();
    const isChained = call && Node.isCallExpression(call) && call.getExpression() === parent;
    if (isChained && (name === 'then' || name === 'catch' || name === 'finally')) {
      if (name === 'then') consumeThen(call, ref, depth);
      else consume(climbValue(call), ref, depth + 1); // .catch()/.finally() pass the value along
      return;
    }
    // (await import('m')).foo — a direct export read.
    ref.members.push({ name, node: parent });
    const decl = parent.getParent();
    if (decl && Node.isVariableDeclaration(decl) && decl.getInitializer() === parent) {
      const nameNode = decl.getNameNode();
      if (Node.isIdentifier(nameNode)) {
        ref.bindings.push(
          name === 'default'
            ? { local: nameNode.getText(), kind: 'default' }
            : { local: nameNode.getText(), kind: 'named', imported: name },
        );
      }
    }
    return;
  }

  // () => import('m') — a deferred loader handed to lazy()/dynamic()/loadable().
  const loader = enclosingLoader(value, parent);
  if (loader) consumeLoaderResult(loader, ref);
}

/** `import('m').then(cb)` — bind the callback parameter, then follow the chain. */
function consumeThen(thenCall: CallExpression, ref: DynamicModuleRef, depth: number): void {
  const cb = thenCall.getArguments()[0];
  if (cb && (Node.isArrowFunction(cb) || Node.isFunctionExpression(cb))) {
    const param = cb.getParameters()[0];
    if (param) bindTarget(param.getNameNode(), ref);
    // `.then(m => ({ default: m.Panel }))` — the chain's "default" is really `Panel`.
    const alias = defaultAliasOf(returnedExpression(cb), ref);
    if (alias) ref.defaultAlias = alias;
  }
  consume(climbValue(thenCall), ref, depth + 1);
}

/**
 * `React.lazy(() => import('m'))` / `dynamic(() => import('m'), …)` — the call's
 * result *is* the module's default export, so bind the variable it lands in.
 */
function consumeLoaderResult(loaderFn: Node, ref: DynamicModuleRef): void {
  const outer = loaderFn.getParent();
  if (!outer || !Node.isCallExpression(outer)) return;
  if (!outer.getArguments().some((a) => a === loaderFn)) return;

  const target = climbValue(outer).getParent();
  if (!target || !Node.isVariableDeclaration(target)) return;
  const nameNode = target.getNameNode();
  if (!Node.isIdentifier(nameNode)) return;

  const local = nameNode.getText();
  ref.bindings.push(
    ref.defaultAlias
      ? { local, kind: 'named', imported: ref.defaultAlias }
      : { local, kind: 'default' },
  );
}

/** The arrow/function expression whose *result* is the module (a lazy loader). */
function enclosingLoader(value: Node, parent: Node): Node | undefined {
  if ((Node.isArrowFunction(parent) || Node.isFunctionExpression(parent)) && parent.getBody() === value) {
    return parent;
  }
  // () => { return import('m'); }
  if (Node.isReturnStatement(parent) && parent.getExpression() === value) {
    for (const anc of parent.getAncestors()) {
      if (Node.isArrowFunction(anc) || Node.isFunctionExpression(anc) || Node.isFunctionDeclaration(anc)) {
        return anc;
      }
    }
  }
  return undefined;
}

/** Bind an identifier (namespace) or destructuring pattern (named exports). */
function bindTarget(nameNode: Node, ref: DynamicModuleRef): void {
  if (Node.isIdentifier(nameNode)) {
    ref.bindings.push({ local: nameNode.getText(), kind: 'namespace' });
    return;
  }
  if (!Node.isObjectBindingPattern(nameNode)) return; // array destructuring isn't a module shape
  for (const el of nameNode.getElements()) {
    if (el.getDotDotDotToken()) continue; // `...rest` — no single export to bind
    const local = el.getNameNode();
    if (!Node.isIdentifier(local)) continue; // nested pattern
    const imported = el.getPropertyNameNode()?.getText() ?? local.getText();
    ref.bindings.push(
      imported === 'default'
        ? { local: local.getText(), kind: 'default' }
        : { local: local.getText(), kind: 'named', imported },
    );
  }
}

/** The expression a callback returns (arrow shorthand or first `return`). */
function returnedExpression(fn: Node): Node | undefined {
  const body = (fn as unknown as { getBody?: () => Node | undefined }).getBody?.();
  if (!body) return undefined;
  if (!Node.isBlock(body)) return body;
  for (const stmt of body.getStatements()) {
    if (Node.isReturnStatement(stmt)) return stmt.getExpression();
  }
  return undefined;
}

/**
 * For `.then(m => ({ default: m.Panel }))` (and `.then(m => m.Panel)`), the export
 * that ends up playing the default role — so `lazy()` binds to the right asset.
 */
function defaultAliasOf(returned: Node | undefined, ref: DynamicModuleRef): string | undefined {
  if (!returned) return undefined;
  const inner = Node.isParenthesizedExpression(returned) ? returned.getExpression() : returned;

  if (Node.isObjectLiteralExpression(inner)) {
    const prop = inner.getProperty('default');
    if (prop && Node.isPropertyAssignment(prop)) return exportNameOf(prop.getInitializer(), ref);
    if (prop && Node.isShorthandPropertyAssignment(prop)) return exportNameOf(prop.getNameNode(), ref);
    return undefined;
  }
  return exportNameOf(inner, ref);
}

/** `m.Panel` → "Panel"; a destructured local → the export it came from. */
function exportNameOf(node: Node | undefined, ref: DynamicModuleRef): string | undefined {
  if (!node) return undefined;
  if (Node.isPropertyAccessExpression(node)) return node.getName();
  if (Node.isIdentifier(node)) {
    const text = node.getText();
    const bound = ref.bindings.find((b) => b.local === text && b.kind === 'named');
    return bound?.imported ?? text;
  }
  return undefined;
}
