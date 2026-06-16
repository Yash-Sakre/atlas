/**
 * Hook extractor.
 *
 * The `use*` prefix is React's own semantic contract for hooks (enforced by the
 * rules-of-hooks), so it is a legitimate semantic signal — not a folder
 * convention. We additionally require the symbol to be a function and to not
 * render JSX (that would make it a component).
 */
import { Node, type SourceFile } from 'ts-morph';
import type { Extractor, ExtractionContext, HookAsset } from '../core/types';
import { rel } from '../core/project';
import {
  getCalledIdentifiers,
  getExportType,
  getLeadingJsDoc,
  getParams,
  getReturnType,
  isHookName,
  location,
  makeId,
  returnsJSX,
  type FunctionLike,
} from './ast-utils';

const REACT_HOOKS = new Set([
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'useReducer',
  'useImperativeHandle',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useInsertionEffect',
]);

export class HookExtractor implements Extractor<HookAsset> {
  name = 'react-hook';
  produces = 'hook' as const;

  extract(file: SourceFile, ctx: ExtractionContext): HookAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const out: HookAsset[] = [];

    const consider = (name: string, fn: FunctionLike, node: Node) => {
      if (!isHookName(name)) return;
      if (returnsJSX(fn)) return; // it's a component, not a hook
      out.push(this.build(name, fn, node, relPath, ctx));
    };

    for (const fn of file.getFunctions()) {
      const name = fn.getName();
      if (name) consider(name, fn, fn);
    }

    for (const decl of file.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        consider(decl.getName(), init, decl);
      }
    }

    return out;
  }

  private build(
    name: string,
    fn: FunctionLike,
    node: Node,
    relPath: string,
    ctx: ExtractionContext,
  ): HookAsset {
    const called = getCalledIdentifiers(fn);
    const reactHooksUsed = called.filter((c) => REACT_HOOKS.has(c));
    const callsHooks = called.filter((c) => isHookName(c) && !REACT_HOOKS.has(c) && c !== name);
    const params = getParams(fn);
    const returnType = getReturnType(fn);

    const tags = ['hook'];
    if (getExportType(node) !== 'none') tags.push('exported');
    if (reactHooksUsed.includes('useState') || reactHooksUsed.includes('useReducer')) tags.push('stateful');
    if (reactHooksUsed.includes('useEffect') || reactHooksUsed.includes('useLayoutEffect')) tags.push('effectful');
    if (reactHooksUsed.includes('useContext')) tags.push('consumes-context');

    return {
      id: makeId(relPath, name),
      name,
      type: 'hook',
      path: relPath,
      exportType: getExportType(node),
      location: location(node, relPath),
      jsDoc: getLeadingJsDoc(node),
      signature: `${name}(${params.map((p) => p.name).join(', ')})`,
      params,
      returnType,
      reactHooksUsed: [...new Set(reactHooksUsed)],
      callsHooks: [...new Set(callsHooks)],
      dependencies: [],
      usedIn: [],
      usageCount: 0,
      examples: [],
      tags,
      workspace: ctx.workspaceOf(relPath),
    };
  }
}
