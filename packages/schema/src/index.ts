/**
 * The Atlas analysis data contract.
 *
 * These are the shapes the CLI writes (`analysis.json`, `data.json`, the
 * per-kind JSON files) and the dashboard reads. Both sides compile against
 * this package, so a change here surfaces as a type error in each of them.
 * Types only — nothing in here exists at runtime.
 */

/** The semantic category a symbol was classified as (by AST, never by filename). */
export type AssetType = 'component' | 'hook' | 'utility' | 'context' | 'store' | 'provider' | 'route';

/** How a symbol leaves its module. */
export type ExportType = 'default' | 'named' | 'none';

export interface SourceLocation {
  /** Path relative to the analyzed project root. */
  filePath: string;
  line: number;
  column: number;
}

/** A place where an asset is referenced/imported. */
export interface UsageReference {
  filePath: string;
  line: number;
  /** What kind of reference this is. */
  kind: 'import' | 'jsx' | 'call' | 'reference';
}

export interface PropInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

/**
 * Provenance of a description's text. `heuristic` is the offline describer;
 * the others are coding agents an asset was handed off to via `atlas describe`.
 */
export type DescriptionSource = 'heuristic' | 'claude' | 'codex' | 'cursor';

/** Structured documentation, produced by the heuristic describer or an agent. */
export interface AIDescription {
  purpose: string;
  responsibilities: string[];
  inputs: string;
  outputs: string;
  dependencies: string[];
  whenToUse: string;
  whenNotToUse: string;
  commonUsage: string;
  examples: string[];
  improvements: string[];
  /** Provenance of the generated text. */
  source: DescriptionSource;
}

/** Common fields shared by every discovered asset. */
export interface BaseAsset {
  /** Stable identity: `<relativePath>#<name>`. Used across graph + search. */
  id: string;
  name: string;
  type: AssetType;
  /** Relative path from project root. */
  path: string;
  exportType: ExportType;
  location: SourceLocation;
  /** Raw leading JSDoc/comment text, if any. */
  jsDoc?: string;
  /** A short rendered signature for display. */
  signature?: string;
  /** Asset ids this asset depends on (resolved during analysis). */
  dependencies: string[];
  /** Every place this asset is used. */
  usedIn: UsageReference[];
  usageCount: number;
  description?: AIDescription;
  examples: string[];
  /** Free-form classification tags (e.g. "validator", "async", "exported"). */
  tags: string[];
  /** Which workspace package this asset belongs to (monorepo support). */
  workspace?: string;
}

export type ComponentKind = 'function' | 'arrow' | 'forwardRef' | 'memo' | 'class';

export interface ComponentAsset extends BaseAsset {
  type: 'component';
  componentKind: ComponentKind;
  props: PropInfo[];
  propsTypeName?: string;
  defaultProps: Record<string, string>;
  /** Component names referenced inside this component's JSX. */
  rendersComponents: string[];
}

export interface HookAsset extends BaseAsset {
  type: 'hook';
  params: ParamInfo[];
  returnType: string;
  /** Built-in React hooks used internally (useState, useEffect, ...). */
  reactHooksUsed: string[];
  /** Other custom hooks called inside this hook. */
  callsHooks: string[];
}

export type UtilKind = 'function' | 'validator' | 'formatter' | 'helper' | 'constant';

export interface UtilAsset extends BaseAsset {
  type: 'utility';
  utilKind: UtilKind;
  params: ParamInfo[];
  returnType: string;
  isAsync: boolean;
  pure: boolean;
}

export type StateKind =
  | 'react-context'
  | 'provider'
  | 'zustand'
  | 'redux-slice'
  | 'jotai-atom'
  | 'recoil-atom';

export interface ContextAsset extends BaseAsset {
  type: 'context' | 'store' | 'provider';
  stateKind: StateKind;
  /** Names of state fields/selectors exposed, when discoverable. */
  stateShape: string[];
}

export type RouterKind = 'react-router' | 'next-app' | 'next-pages' | 'tanstack-router';

export interface RouteAsset extends BaseAsset {
  type: 'route';
  router: RouterKind;
  /** URL path, e.g. "/dashboard/:id". */
  routePath: string;
  /** Component rendered for this route, if resolvable. */
  componentName?: string;
  /** Child route paths (nested routing). */
  childRoutes: string[];
  /** "page" | "layout" | "route" for Next.js app router. */
  segmentKind?: 'page' | 'layout' | 'route' | 'template' | 'loading' | 'error';
}

export type Asset = ComponentAsset | HookAsset | UtilAsset | ContextAsset | RouteAsset;

/* --------------------------------- Graph --------------------------------- */

export interface GraphNode {
  id: string;
  label: string;
  type: AssetType | 'file' | 'external';
  path: string;
  usageCount: number;
}

export type EdgeKind = 'imports' | 'renders' | 'uses' | 'provides';

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* ------------------------------ Dead code -------------------------------- */

export interface DeadExport {
  id: string;
  name: string;
  path: string;
  type: AssetType;
}

export interface DuplicateCandidate {
  /** Asset ids suspected to be duplicates. */
  ids: string[];
  names: string[];
  reason: string;
  similarity: number;
}

export interface DeadCodeReport {
  unusedComponents: DeadExport[];
  unusedHooks: DeadExport[];
  unusedUtils: DeadExport[];
  unusedContexts: DeadExport[];
  deadExports: DeadExport[];
  orphanFiles: string[];
  duplicateCandidates: DuplicateCandidate[];
}

/* --------------------------- Architecture -------------------------------- */

export interface FolderNode {
  name: string;
  path: string;
  fileCount: number;
  assetCount: number;
  children: FolderNode[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  assetCount: number;
  /** Module names this module imports from. */
  dependsOn: string[];
}

export interface ArchitectureViolation {
  from: string;
  to: string;
  message: string;
  recommendation: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ArchitectureInsights {
  folderStructure: FolderNode;
  modules: ModuleInfo[];
  sharedLayer: string[];
  violations: ArchitectureViolation[];
}

/* ----------------------------- Dependencies ------------------------------ */

/** Which section of package.json a dependency was declared in. */
export type DependencyKind = 'prod' | 'dev' | 'peer' | 'optional';

/**
 * Where a dependency actually resolves from, inferred from its version range.
 * Only `registry` packages exist on npm — the rest (local `file:`/`link:` links
 * such as yalc, `workspace:` protocol, git/url installs) have no npm page,
 * version badge, or update to check.
 */
export type DependencySource = 'registry' | 'file' | 'git' | 'workspace' | 'url';

/** A single third-party package declared in the project's package.json(s). */
export type DependencyToolingUse = 'script' | 'config' | 'types';

export interface DependencyInfo {
  name: string;
  /** Declared version range, e.g. "^12.1.0" or "file:.yalc/pkg". */
  range: string;
  /** Resolved installed version from node_modules, when present. */
  installed?: string;
  kind: DependencyKind;
  /** How the package resolves — registry vs a local/git/url install. */
  source: DependencySource;
  /** How many source files import this package (bare-specifier imports). */
  usedInCount: number;
  /**
   * Non-import ways the project uses the package: a binary run from a
   * package.json script, a name in a tool config (`postcss.config.cjs`, …), or
   * a `@types/*` package the compiler picks up. A package with any of these is
   * not unused even when `usedInCount` is 0.
   */
  toolingUse?: DependencyToolingUse[];
  /** Workspace package that declares it (monorepo); undefined = repo root. */
  workspace?: string;
  /** Canonical npmjs.com package page — only for registry packages. */
  npmUrl?: string;
}

export interface DependencyReport {
  dependencies: DependencyInfo[];
  counts: { prod: number; dev: number; peer: number; optional: number; total: number };
}

/* ----------------------------- Static assets ------------------------------ */

/** Broad category of a static (non-code) file, derived from its extension. */
export type StaticAssetKind = 'image' | 'vector' | 'font' | 'video' | 'audio' | 'document';

/**
 * A static file the app ships: an image, icon, font, media clip or document.
 *
 * Atlas never copies these anywhere — it records the path on disk and the
 * dashboard loads each file from that path through the local server.
 */
export interface StaticAsset {
  /** Stable identity — the root-relative path (unique per file). */
  id: string;
  /** File name including extension, e.g. "hero.png". */
  name: string;
  /** Path relative to the project root, POSIX separators. */
  path: string;
  /** Lowercased extension without the dot, e.g. "png". */
  ext: string;
  kind: StaticAssetKind;
  /** Size on disk, in bytes. */
  size: number;
  /** Last modification time (ISO 8601). */
  modified: string;
  /** Intrinsic pixel size, when readable from the file header. */
  dimensions?: { width: number; height: number };
  /**
   * Lives under a framework `public/`/`static/` dir, i.e. it is served verbatim
   * rather than going through the bundler.
   */
  isPublic: boolean;
  /** URL the file is served at in the app — only for `public/`/`static/` files. */
  publicUrl?: string;
  /** Source/style/markup files that reference this file. */
  usedIn: UsageReference[];
  usageCount: number;
  workspace?: string;
}

export interface StaticAssetReport {
  assets: StaticAsset[];
  counts: {
    total: number;
    /** How many are never referenced from code, styles or markup. */
    unused: number;
    /** Combined size on disk, in bytes. */
    totalBytes: number;
    byKind: Record<StaticAssetKind, number>;
  };
}

/* -------------------------------- Search --------------------------------- */

export interface SearchRecord {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  description: string;
  tags: string[];
  keywords: string[];
}

/* ------------------------------- Result ---------------------------------- */

export interface AnalysisStats {
  fileCount: number;
  components: number;
  hooks: number;
  utils: number;
  contexts: number;
  routes: number;
  dependencies: number;
  staticAssets: number;
  unusedExports: number;
  duplicateCandidates: number;
  durationMs: number;
}

export interface AnalysisMeta {
  generatedAt: string;
  toolVersion: string;
  root: string;
  framework: FrameworkInfo;
  workspaces: string[];
}

export interface AnalysisResult {
  meta: AnalysisMeta;
  components: ComponentAsset[];
  hooks: HookAsset[];
  utils: UtilAsset[];
  contexts: ContextAsset[];
  routes: RouteAsset[];
  graph: DependencyGraph;
  deadCode: DeadCodeReport;
  architecture: ArchitectureInsights;
  dependencies: DependencyReport;
  staticAssets: StaticAssetReport;
  search: SearchRecord[];
  stats: AnalysisStats;
}

/* ----------------------------- Framework --------------------------------- */

export interface FrameworkInfo {
  next: boolean;
  nextRouter: 'app' | 'pages' | 'both' | 'none';
  vite: boolean;
  reactRouter: boolean;
  tanstackRouter: boolean;
  react: boolean;
  stateLibs: string[];
}
