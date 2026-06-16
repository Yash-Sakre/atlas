/**
 * Core type contract for Atlas.
 *
 * Every extractor, analyzer, AI provider, and output writer compiles against
 * the types in this file. It is the single source of truth for the shape of a
 * discovered asset and an analysis result. Keep it dependency-free (only
 * `ts-morph` types are allowed) so it can be imported from anywhere.
 */
import type { Project, SourceFile } from 'ts-morph';

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
  search: SearchRecord[];
  stats: AnalysisStats;
}

/** Convenience accessor for "all assets regardless of category". */
export function allAssets(result: AnalysisResult): Asset[] {
  return [
    ...result.components,
    ...result.hooks,
    ...result.utils,
    ...result.contexts,
    ...result.routes,
  ];
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

/* ----------------------------- Config ------------------------------------ */

export interface UserConfig {
  /** Globs to include (relative to root). */
  include?: string[];
  /** Globs to exclude. */
  exclude?: string[];
  /** Enable incremental cache. */
  cache?: boolean;
  /** Output directory. */
  outDir?: string;
  /** Plugin module paths. */
  plugins?: string[];
  /** Treat these top-level folders as the "shared/common" layer. */
  sharedLayers?: string[];
}

export interface ResolvedConfig extends Required<Omit<UserConfig, 'plugins' | 'sharedLayers'>> {
  root: string;
  plugins: string[];
  sharedLayers: string[];
}

/* ---------------------------- Extraction --------------------------------- */

/** Shared state passed to every extractor and analyzer. */
export interface ExtractionContext {
  project: Project;
  sourceFiles: SourceFile[];
  config: ResolvedConfig;
  /** Root-level framework detection (also surfaced in result.meta). */
  framework: FrameworkInfo;
  root: string;
  /** Map of relative path -> workspace package name. */
  workspaceOf: (filePath: string) => string | undefined;
  /**
   * Framework detection for the file's own workspace (monorepo-aware).
   * Falls back to the root framework for files outside any workspace.
   */
  frameworkOf: (filePath: string) => FrameworkInfo;
}

/**
 * An Extractor turns one source file into zero or more assets.
 * Plugins implement this interface to add new asset kinds or frameworks.
 */
export interface Extractor<T extends Asset = Asset> {
  /** Unique extractor name (used for plugin overrides + logging). */
  name: string;
  /** Asset type(s) this extractor produces. */
  produces: AssetType | AssetType[];
  extract(file: SourceFile, ctx: ExtractionContext): T[];
}

/* ----------------------------- Plugins ----------------------------------- */

export interface Plugin {
  name: string;
  /** Extra extractors contributed by this plugin. */
  extractors?: Extractor[];
  /** Hook to mutate/enrich the final result. */
  enrich?(result: AnalysisResult, ctx: ExtractionContext): void | Promise<void>;
}
