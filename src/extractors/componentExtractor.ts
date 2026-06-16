/**
 * Component extractor.
 *
 * Classifies a symbol as a React component using semantics only:
 *   - PascalCase name, AND
 *   - returns JSX (directly, or via a memo()/forwardRef() wrapper), OR
 *   - is a class extending React.Component.
 * Folder/file names are never consulted.
 */
import {
  Node,
  SymbolFlags,
  SyntaxKind,
  type ClassDeclaration,
  type ParameterDeclaration,
  type SourceFile,
  type Symbol as TsSymbol,
} from 'ts-morph';
import type { ComponentAsset, ComponentKind, Extractor, ExtractionContext, PropInfo } from '../core/types';
import { rel } from '../core/project';
import {
  getExportType,
  getLeadingJsDoc,
  getRenderedComponents,
  isPascalCase,
  location,
  makeId,
  returnsJSX,
  safeType,
  unwrapHocCalls,
  type FunctionLike,
} from './ast-utils';

export class ComponentExtractor implements Extractor<ComponentAsset> {
  name = 'react-component';
  produces = 'component' as const;

  extract(file: SourceFile, ctx: ExtractionContext): ComponentAsset[] {
    const relPath = rel(ctx.root, file.getFilePath());
    const out: ComponentAsset[] = [];
    const seen = new Set<string>();

    const push = (a: ComponentAsset | null) => {
      if (a && !seen.has(a.name)) {
        seen.add(a.name);
        out.push(a);
      }
    };

    // 1. function declarations
    for (const fn of file.getFunctions()) {
      const name = fn.getName();
      if (!name || !isPascalCase(name)) continue;
      if (!returnsJSX(fn)) continue;
      push(this.build(name, 'function', fn, fn.getParameters()[0], relPath, ctx, file));
    }

    // 2. variable declarations (arrow / fn expr / memo / forwardRef)
    for (const decl of file.getVariableDeclarations()) {
      const name = decl.getName();
      if (!isPascalCase(name)) continue;
      const init = decl.getInitializer();
      if (!init) continue;

      const { inner, hoc } = unwrapHocCalls(init);
      let fn: FunctionLike | undefined;
      if (Node.isArrowFunction(inner) || Node.isFunctionExpression(inner)) fn = inner;
      if (!fn) continue;

      const isForwardRef = hoc.includes('forwardRef');
      const isMemo = hoc.includes('memo');
      if (!isForwardRef && !isMemo && !returnsJSX(fn)) continue;
      if ((isForwardRef || isMemo) && !returnsJSX(fn)) continue;

      const kind: ComponentKind = isForwardRef ? 'forwardRef' : isMemo ? 'memo' : 'arrow';
      // forwardRef render fn signature is (props, ref) → props is first param
      const propsParam = fn.getParameters()[0];
      push(this.build(name, kind, fn, propsParam, relPath, ctx, file, decl));
    }

    // 3. class components
    for (const cls of file.getClasses()) {
      const name = cls.getName();
      if (!name || !isPascalCase(name)) continue;
      if (!extendsReactComponent(cls)) continue;
      out.push(this.buildClass(name, cls, relPath, ctx, file));
    }

    return out;
  }

  private build(
    name: string,
    kind: ComponentKind,
    fn: FunctionLike,
    propsParam: ParameterDeclaration | undefined,
    relPath: string,
    ctx: ExtractionContext,
    file: SourceFile,
    declNode?: Node,
  ): ComponentAsset {
    const node = declNode ?? fn;
    const { props, propsTypeName, defaultProps } = extractProps(propsParam);
    mergeStaticDefaultProps(file, name, defaultProps);

    const body = fn.getBody?.() ?? fn;
    const renders = getRenderedComponents(body);
    const jsDoc = getLeadingJsDoc(node);

    return {
      id: makeId(relPath, name),
      name,
      type: 'component',
      path: relPath,
      exportType: getExportType(node),
      location: location(node, relPath),
      jsDoc,
      signature: `<${name}${props.length ? ' …props' : ''} />`,
      componentKind: kind,
      props,
      propsTypeName,
      defaultProps,
      rendersComponents: renders,
      dependencies: [],
      usedIn: [],
      usageCount: 0,
      examples: [],
      tags: buildTags(kind, props, getExportType(node)),
      workspace: ctx.workspaceOf(relPath),
    };
  }

  private buildClass(
    name: string,
    cls: ClassDeclaration,
    relPath: string,
    ctx: ExtractionContext,
    file: SourceFile,
  ): ComponentAsset {
    const defaultProps: Record<string, string> = {};
    mergeStaticDefaultProps(file, name, defaultProps);
    // class props come from the first type argument of `extends Component<Props>`
    let props: PropInfo[] = [];
    let propsTypeName: string | undefined;
    const base = cls.getExtends();
    const typeArg = base?.getTypeArguments()?.[0];
    if (typeArg) {
      propsTypeName = typeArg.getText();
      props = propsFromType(typeArg.getType(), typeArg);
    }
    const renderMethod = cls.getMethod('render');
    const renders = renderMethod ? getRenderedComponents(renderMethod) : [];

    return {
      id: makeId(relPath, name),
      name,
      type: 'component',
      path: relPath,
      exportType: getExportType(cls),
      location: location(cls, relPath),
      jsDoc: getLeadingJsDoc(cls),
      signature: `<${name} />`,
      componentKind: 'class',
      props,
      propsTypeName,
      defaultProps,
      rendersComponents: renders,
      dependencies: [],
      usedIn: [],
      usageCount: 0,
      examples: [],
      tags: buildTags('class', props, getExportType(cls)),
      workspace: ctx.workspaceOf(relPath),
    };
  }
}

function buildTags(kind: ComponentKind, props: PropInfo[], exp: string): string[] {
  const tags = ['component', kind];
  if (exp !== 'none') tags.push('exported');
  if (props.length === 0) tags.push('no-props');
  return tags;
}

function extendsReactComponent(cls: ClassDeclaration): boolean {
  const ext = cls.getExtends();
  if (!ext) return false;
  const text = ext.getExpression().getText();
  return /(^|\.)(Component|PureComponent)$/.test(text);
}

/** Extract props from the props parameter via the type checker + destructure defaults. */
function extractProps(param: ParameterDeclaration | undefined): {
  props: PropInfo[];
  propsTypeName?: string;
  defaultProps: Record<string, string>;
} {
  const defaultProps: Record<string, string> = {};
  if (!param) return { props: [], defaultProps };

  // Destructured defaults: ({ variant = 'primary' }) => ...
  const nameNode = param.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.getElements()) {
      const init = el.getInitializer();
      if (init) defaultProps[el.getName()] = init.getText();
    }
  }

  const typeNode = param.getTypeNode();
  const propsTypeName =
    typeNode && Node.isTypeReference(typeNode) ? typeNode.getText() : undefined;

  let props: PropInfo[] = [];
  try {
    props = propsFromType(param.getType(), param);
  } catch {
    props = [];
  }
  // attach destructure defaults
  for (const p of props) {
    if (defaultProps[p.name] !== undefined) p.defaultValue = defaultProps[p.name];
  }
  return { props, propsTypeName, defaultProps };
}

function propsFromType(type: ReturnType<ParameterDeclaration['getType']>, atNode: Node): PropInfo[] {
  const props: PropInfo[] = [];
  for (const sym of type.getProperties()) {
    const name = sym.getName();
    if (name.startsWith('__')) continue;
    const decl = sym.getValueDeclaration() ?? sym.getDeclarations()[0];
    let typeText = 'unknown';
    try {
      typeText = safeType(sym.getTypeAtLocation(decl ?? atNode));
    } catch {
      /* ignore */
    }
    const optional = isOptionalSymbol(sym, decl);
    props.push({
      name,
      type: typeText,
      optional,
      description: decl ? jsDocOfSymbol(decl) : undefined,
    });
  }
  return props.sort((a, b) => a.name.localeCompare(b.name));
}

function isOptionalSymbol(sym: TsSymbol, decl?: Node): boolean {
  if ((sym.getFlags() & SymbolFlags.Optional) !== 0) return true;
  if (decl && (Node.isPropertySignature(decl) || Node.isPropertyDeclaration(decl))) {
    return decl.hasQuestionToken();
  }
  return false;
}

function jsDocOfSymbol(decl: Node): string | undefined {
  if (Node.isJSDocable(decl)) {
    const docs = decl.getJsDocs();
    const text = docs.map((d) => d.getDescription().trim()).filter(Boolean).join(' ');
    return text || undefined;
  }
  return undefined;
}

/** Merge `Name.defaultProps = {...}` static assignments. */
function mergeStaticDefaultProps(file: SourceFile, name: string, into: Record<string, string>): void {
  for (const stmt of file.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const left = stmt.getLeft().getText();
    if (left === `${name}.defaultProps`) {
      const right = stmt.getRight();
      if (Node.isObjectLiteralExpression(right)) {
        for (const prop of right.getProperties()) {
          if (Node.isPropertyAssignment(prop)) {
            into[prop.getName()] = prop.getInitializerOrThrow().getText();
          }
        }
      }
    }
  }
}
