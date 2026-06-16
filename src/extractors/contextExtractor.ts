/**
 * Context / store / provider extractor.
 *
 * Detects state ownership by call-expression semantics and the module a symbol
 * was imported from — never by file name:
 *   - createContext(...)            → react-context
 *   - <X.Provider> in a component   → provider
 *   - create(...) from 'zustand'    → zustand store
 *   - createSlice(...) from RTK     → redux-slice
 *   - atom(...) from 'jotai'        → jotai-atom
 *   - atom(...) from 'recoil'       → recoil-atom
 */
import { Node, SyntaxKind, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { ContextAsset, Extractor, ExtractionContext, StateKind } from '../core/types';
import { rel } from '../core/project';
import { getExportType, getLeadingJsDoc, location, makeId } from './ast-utils';

/** import name → module specifier, for this file. */
function importMap(file: SourceFile): Map<string, string> {
  const map = new Map<string, string>();
  for (const imp of file.getImportDeclarations()) {
    const mod = imp.getModuleSpecifierValue();
    const def = imp.getDefaultImport();
    if (def) map.set(def.getText(), mod);
    for (const named of imp.getNamedImports()) {
      map.set(named.getName(), mod);
      const alias = named.getAliasNode();
      if (alias) map.set(alias.getText(), mod);
    }
  }
  return map;
}

function calleeName(decl: VariableDeclaration): { name: string; node: Node } | null {
  const init = decl.getInitializer();
  if (!init || !Node.isCallExpression(init)) return null;
  const expr = init.getExpression();
  return { name: expr.getText(), node: init };
}

function classify(callee: string, imports: Map<string, string>): { kind: StateKind; type: ContextAsset['type'] } | null {
  const base = callee.split('.').pop() ?? callee;
  const root = callee.split('.')[0];
  const mod = imports.get(base) ?? imports.get(root);

  if (base === 'createContext') return { kind: 'react-context', type: 'context' };
  if (base === 'create' && mod === 'zustand') return { kind: 'zustand', type: 'store' };
  if (base === 'createStore' && mod === 'zustand') return { kind: 'zustand', type: 'store' };
  if (base === 'createSlice') return { kind: 'redux-slice', type: 'store' };
  if (base === 'atom' && mod === 'jotai') return { kind: 'jotai-atom', type: 'store' };
  if (base === 'atom' && mod === 'recoil') return { kind: 'recoil-atom', type: 'store' };
  if (base === 'atomWithStorage' && mod === 'jotai/utils') return { kind: 'jotai-atom', type: 'store' };
  return null;
}

/** Pull state field names out of the call's first object/function argument. */
function stateShape(callNode: Node, kind: StateKind): string[] {
  if (!Node.isCallExpression(callNode)) return [];
  const arg = callNode.getArguments()[0];
  if (!arg) return [];

  const keysOfObject = (obj: Node): string[] => {
    if (!Node.isObjectLiteralExpression(obj)) return [];
    return obj.getProperties().map((p) => ('getName' in p ? (p as any).getName() : '')).filter(Boolean);
  };

  if (kind === 'zustand') {
    // create((set,get) => ({...}))  or create(() => ({...}))
    if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
      const body = arg.getBody();
      // concise body: () => ({...})
      let obj: Node | undefined;
      if (Node.isParenthesizedExpression(body)) obj = body.getExpression();
      else if (Node.isObjectLiteralExpression(body)) obj = body;
      else {
        const ret = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
        obj = ret?.getExpression();
      }
      return obj ? keysOfObject(obj) : [];
    }
    return keysOfObject(arg);
  }

  if (kind === 'redux-slice') {
    if (Node.isObjectLiteralExpression(arg)) {
      const shape: string[] = [];
      const initial = arg.getProperty('initialState');
      if (initial && Node.isPropertyAssignment(initial)) {
        const v = initial.getInitializer();
        if (v) shape.push(...keysOfObject(v));
      }
      const reducers = arg.getProperty('reducers');
      if (reducers && Node.isPropertyAssignment(reducers)) {
        const v = reducers.getInitializer();
        if (v) shape.push(...keysOfObject(v).map((k) => `${k}()`));
      }
      return shape;
    }
  }

  return [];
}

export class ContextExtractor implements Extractor<ContextAsset> {
  name = 'state-container';
  produces: ContextAsset['type'][] = ['context', 'store', 'provider'];

  extract(file: SourceFile, ctx: ExtractionContext): ContextAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const imports = importMap(file);
    const out: ContextAsset[] = [];
    const seen = new Set<string>();

    // Context / store containers from call expressions.
    for (const decl of file.getVariableDeclarations()) {
      const callee = calleeName(decl);
      if (!callee) continue;
      const cls = classify(callee.name, imports);
      if (!cls) continue;
      const name = decl.getName();
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        id: makeId(relPath, name),
        name,
        type: cls.type,
        path: relPath,
        exportType: getExportType(decl),
        location: location(decl, relPath),
        jsDoc: getLeadingJsDoc(decl),
        signature: `${callee.name}(…) → ${name}`,
        stateKind: cls.kind,
        stateShape: stateShape(callee.node, cls.kind),
        dependencies: [],
        usedIn: [],
        usageCount: 0,
        examples: [],
        tags: ['state', cls.kind, cls.type],
        workspace: ctx.workspaceOf(relPath),
      });
    }

    // Providers: components rendering <X.Provider>.
    for (const provider of this.findProviders(file, relPath)) {
      if (seen.has(provider.name)) continue;
      seen.add(provider.name);
      out.push({
        id: makeId(relPath, provider.name),
        name: provider.name,
        type: 'provider',
        path: relPath,
        exportType: provider.exportType,
        location: provider.loc,
        jsDoc: provider.jsDoc,
        signature: `<${provider.name}>{children}</${provider.name}>`,
        stateKind: 'provider',
        stateShape: provider.contexts,
        dependencies: [],
        usedIn: [],
        usageCount: 0,
        examples: [],
        tags: ['state', 'provider'],
        workspace: ctx.workspaceOf(relPath),
      });
    }

    return out;
  }

  private findProviders(file: SourceFile, relPath: string) {
    const result: Array<{
      name: string;
      exportType: ContextAsset['exportType'];
      loc: ReturnType<typeof location>;
      jsDoc?: string;
      contexts: string[];
    }> = [];

    const check = (name: string | undefined, node: Node) => {
      if (!name || !/^[A-Z]/.test(name)) return;
      const opening = node.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).map((el) => el.getTagNameNode().getText());
      const selfClosing = node
        .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
        .map((el) => el.getTagNameNode().getText());
      const providerTags = [...opening, ...selfClosing].filter((t) => /\.Provider$/.test(t));
      if (providerTags.length === 0) return;
      result.push({
        name,
        exportType: getExportType(node),
        loc: location(node, relPath),
        jsDoc: getLeadingJsDoc(node),
        contexts: [...new Set(providerTags.map((t) => t.replace(/\.Provider$/, '')))],
      });
    };

    for (const fn of file.getFunctions()) check(fn.getName(), fn);
    for (const decl of file.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        check(decl.getName(), decl);
      }
    }
    return result;
  }
}
