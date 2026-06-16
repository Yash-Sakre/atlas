/**
 * Low-level AST helpers shared by every extractor.
 *
 * These operate purely on semantics (return types, call expressions, JSX
 * presence) — never on file paths or folder names — so the tool works in
 * poorly organized repos.
 */
import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type ExportableNode,
  type FunctionDeclaration,
  type FunctionExpression,
  type JSDocableNode,
  type NamedNode,
  type SourceFile,
  type Type,
  type VariableDeclaration,
} from 'ts-morph';
import type { ExportType, ParamInfo, SourceLocation } from '../core/types';

export type FunctionLike = FunctionDeclaration | FunctionExpression | ArrowFunction;

export function makeId(relPath: string, name: string): string {
  return `${relPath}#${name}`;
}

export function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

/** `useFoo`, but not just `use`. */
export function isHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name);
}

export function location(node: Node, relPath: string): SourceLocation {
  const start = node.getStartLineNumber();
  return { filePath: relPath, line: start, column: node.getStartLinePos() };
}

export function getLeadingJsDoc(node: Node): string | undefined {
  if (Node.isJSDocable(node)) {
    const docs = (node as unknown as JSDocableNode).getJsDocs();
    if (docs.length) {
      const text = docs.map((d) => d.getDescription().trim()).filter(Boolean).join('\n');
      if (text) return text;
    }
  }
  // Fall back to a leading line/block comment.
  const ranges = node.getLeadingCommentRanges();
  if (ranges.length) {
    return ranges
      .map((r) => r.getText().replace(/^\/\*+|\*+\/$|^\/\//gm, '').replace(/^\s*\*/gm, '').trim())
      .join('\n')
      .trim() || undefined;
  }
  return undefined;
}

/** Determine how a declaration is exported. */
export function getExportType(node: Node): ExportType {
  if (!Node.isExportable(node)) {
    // Variable declarations are exported via their statement.
    if (Node.isVariableDeclaration(node)) {
      const stmt = node.getVariableStatement();
      if (stmt) return getExportType(stmt);
    }
    return 'none';
  }
  const exportable = node as unknown as ExportableNode;
  if (exportable.isDefaultExport && exportable.isDefaultExport()) return 'default';
  if (exportable.isExported && exportable.isExported()) return 'named';
  return 'none';
}

/** True if the function's body contains JSX anywhere. */
export function returnsJSX(fn: FunctionLike): boolean {
  // Arrow with concise body: `() => <div/>`
  if (Node.isArrowFunction(fn)) {
    const body = fn.getBody();
    if (body && isJSXish(body)) return true;
  }
  const body = fn.getBody?.();
  if (!body) return false;
  return (
    body.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    body.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    body.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

function isJSXish(node: Node): boolean {
  const k = node.getKind();
  return (
    k === SyntaxKind.JsxElement ||
    k === SyntaxKind.JsxSelfClosingElement ||
    k === SyntaxKind.JsxFragment ||
    k === SyntaxKind.ParenthesizedExpression
  );
}

/** Extract parameter info from a function-like node. */
export function getParams(fn: FunctionLike): ParamInfo[] {
  return fn.getParameters().map((p) => ({
    name: p.getName(),
    type: safeType(p.getType()),
    optional: p.isOptional() || p.hasInitializer(),
    defaultValue: p.getInitializer()?.getText(),
  }));
}

export function getReturnType(fn: FunctionLike): string {
  try {
    return safeType(fn.getReturnType());
  } catch {
    return 'unknown';
  }
}

/** Render a type to a readable string, guarding against huge/circular types. */
export function safeType(type: Type): string {
  try {
    const text = type.getText();
    if (!text || text.length > 120) {
      // Collapse oversized inferred types.
      if (type.isObject()) return 'object';
      return text ? text.slice(0, 117) + '…' : 'unknown';
    }
    return text.replace(/import\([^)]*\)\./g, '');
  } catch {
    return 'unknown';
  }
}

/** Collect names of JSX tags rendered inside a node (component references). */
export function getRenderedComponents(node: Node): string[] {
  const names = new Set<string>();
  const collect = (tagName: string) => {
    const root = tagName.split('.')[0];
    if (isPascalCase(root)) names.add(root);
  };
  node.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((el) => collect(el.getTagNameNode().getText()));
  node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((el) => collect(el.getTagNameNode().getText()));
  return [...names];
}

/** Collect names of every call expression callee (for hook/util detection). */
export function getCalledIdentifiers(node: Node): string[] {
  const names = new Set<string>();
  node.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
    const expr = call.getExpression();
    if (Node.isIdentifier(expr)) names.add(expr.getText());
    else if (Node.isPropertyAccessExpression(expr)) names.add(expr.getName());
  });
  return [...names];
}

export function getName(node: Node): string | undefined {
  if (Node.isNameable(node) || Node.isNamed(node)) {
    return (node as unknown as NamedNode).getName?.();
  }
  if (Node.isVariableDeclaration(node)) return (node as VariableDeclaration).getName();
  return undefined;
}

/** The initializer of `const Foo = <fn>` unwrapped past memo()/forwardRef(). */
export function unwrapHocCalls(node: Node): { inner: Node; hoc: string[] } {
  const hoc: string[] = [];
  let current = node;
  for (let i = 0; i < 4; i++) {
    if (Node.isCallExpression(current)) {
      const expr = current.getExpression();
      const calleeText = expr.getText();
      if (/(^|\.)(memo|forwardRef|observer)$/.test(calleeText)) {
        hoc.push(calleeText.split('.').pop()!);
        const arg = current.getArguments()[0];
        if (arg) {
          current = arg;
          continue;
        }
      }
    }
    break;
  }
  return { inner: current, hoc };
}

/** All exported declarations in a file with name + node, including re-exports. */
export function getExportedDeclarations(file: SourceFile): Array<{ name: string; node: Node }> {
  const out: Array<{ name: string; node: Node }> = [];
  for (const [name, decls] of file.getExportedDeclarations()) {
    for (const decl of decls) {
      // Only keep declarations physically located in this file.
      if (decl.getSourceFile().getFilePath() === file.getFilePath()) {
        out.push({ name, node: decl });
      }
    }
  }
  return out;
}
