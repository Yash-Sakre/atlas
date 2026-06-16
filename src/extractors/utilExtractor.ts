/**
 * Utility extractor.
 *
 * A utility is any top-level function-like symbol that the other extractors did
 * NOT claim — i.e. it does not render JSX (not a component) and is not named
 * `use*` (not a hook). Kind is inferred from the signature, never the path.
 */
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import type { Extractor, ExtractionContext, UtilAsset, UtilKind } from '../core/types';
import { rel } from '../core/project';
import {
  getExportType,
  getLeadingJsDoc,
  getParams,
  getReturnType,
  isHookName,
  isPascalCase,
  location,
  makeId,
  returnsJSX,
  type FunctionLike,
} from './ast-utils';

const SIDE_EFFECT_TOKENS = ['fetch', 'console', 'document', 'window', 'localStorage', 'sessionStorage'];

export class UtilExtractor implements Extractor<UtilAsset> {
  name = 'utility-function';
  produces = 'utility' as const;

  extract(file: SourceFile, ctx: ExtractionContext): UtilAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const out: UtilAsset[] = [];

    const consider = (name: string, fn: FunctionLike, node: Node, isAsync: boolean) => {
      if (isHookName(name)) return; // hook
      if (returnsJSX(fn)) return; // component
      if (isPascalCase(name) && fn.getParameters().length === 0) return; // likely a component shell
      out.push(this.build(name, fn, node, relPath, ctx, isAsync));
    };

    for (const fn of file.getFunctions()) {
      const name = fn.getName();
      if (name) consider(name, fn, fn, fn.isAsync());
    }

    for (const decl of file.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        consider(decl.getName(), init, decl, init.isAsync());
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
    isAsync: boolean,
  ): UtilAsset {
    const params = getParams(fn);
    const returnType = getReturnType(fn);
    const kind = classifyUtil(name, returnType);
    const bodyText = (fn.getBody?.() ?? fn).getText();
    const pure = !isAsync && !SIDE_EFFECT_TOKENS.some((t) => new RegExp(`\\b${t}\\b`).test(bodyText));

    const tags = ['utility', kind];
    if (getExportType(node) !== 'none') tags.push('exported');
    if (isAsync) tags.push('async');
    if (pure) tags.push('pure');

    return {
      id: makeId(relPath, name),
      name,
      type: 'utility',
      path: relPath,
      exportType: getExportType(node),
      location: location(node, relPath),
      jsDoc: getLeadingJsDoc(node),
      signature: `${name}(${params.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${returnType}`,
      utilKind: kind,
      params,
      returnType,
      isAsync,
      pure,
      dependencies: [],
      usedIn: [],
      usageCount: 0,
      examples: [],
      tags,
      workspace: ctx.workspaceOf(relPath),
    };
  }
}

function classifyUtil(name: string, returnType: string): UtilKind {
  if (/^(is|has|can|should|validate|check|assert)[A-Z]/.test(name) || returnType === 'boolean') {
    if (/^(is|has|can|should|validate|check|assert)/.test(name)) return 'validator';
  }
  if (/^(format|to|parse|serialize|stringify|render|display|humanize|slugify)[A-Z]?/.test(name)) {
    return 'formatter';
  }
  if (/^(get|map|build|create|make|group|sort|filter|merge|pick|omit|clamp|chunk|debounce|throttle)/.test(name)) {
    return 'helper';
  }
  return 'function';
}
