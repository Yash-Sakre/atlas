/**
 * Loose mirror of the analyzer's output shape. The dashboard only reads data,
 * so these are intentionally permissive — every view tolerates missing fields.
 */

export type AssetType =
  | 'component'
  | 'hook'
  | 'utility'
  | 'context'
  | 'store'
  | 'provider'
  | 'route'
  | 'file'
  | 'external';

export interface Description {
  source?: string;
  purpose?: string;
  inputs?: string;
  outputs?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  responsibilities?: string[];
  improvements?: string[];
  examples?: string[];
}

export interface Param {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface SourceLocation {
  /** Path relative to the analyzed project root. */
  filePath: string;
  line: number;
  column?: number;
}

export interface UsageRef {
  filePath: string;
  line: number;
  kind: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  /** Where the symbol is declared — used for "open in editor" deep links. */
  location?: SourceLocation;
  usageCount?: number;
  description?: Description;
  signature?: string;
  returnType?: string;
  props?: Param[];
  params?: Param[];
  tags?: string[];
  stateShape?: string[];
  dependencies?: string[];
  usedIn?: UsageRef[];
  // Route specifics
  routePath?: string;
  componentName?: string;
  segmentKind?: string;
  childRoutes?: string[];
}

export interface GraphNode {
  id: string;
  label?: string;
  type: AssetType;
  path?: string;
  usageCount?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface Stats {
  fileCount: number;
  components: number;
  hooks: number;
  utils: number;
  contexts: number;
  routes: number;
  dependencies?: number;
  staticAssets?: number;
  unusedExports: number;
  duplicateCandidates: number;
  durationMs: number;
}

export type DependencyKind = 'prod' | 'dev' | 'peer' | 'optional';
export type DependencySource = 'registry' | 'file' | 'git' | 'workspace' | 'url';

export interface DependencyInfo {
  name: string;
  range: string;
  installed?: string;
  kind: DependencyKind;
  source?: DependencySource;
  usedInCount: number;
  workspace?: string;
  npmUrl?: string;
}

export interface DependencyReport {
  dependencies: DependencyInfo[];
  counts: { prod: number; dev: number; peer: number; optional: number; total: number };
}

export type StaticAssetKind = 'image' | 'vector' | 'font' | 'video' | 'audio' | 'document';

/** A static file on disk. Previews load from `path`; nothing is ever inlined. */
export interface StaticAsset {
  id: string;
  name: string;
  path: string;
  ext: string;
  kind: StaticAssetKind;
  size: number;
  modified?: string;
  dimensions?: { width: number; height: number };
  isPublic?: boolean;
  publicUrl?: string;
  usedIn?: UsageRef[];
  usageCount?: number;
  workspace?: string;
}

export interface StaticAssetReport {
  assets: StaticAsset[];
  counts: {
    total: number;
    unused: number;
    totalBytes: number;
    byKind: Partial<Record<StaticAssetKind, number>>;
  };
}

export interface SearchRecord {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  description?: string;
  tags?: string[];
  keywords?: string[];
}

export interface AnalysisResult {
  meta: {
    generatedAt: string;
    toolVersion: string;
    root: string;
    framework: {
      react?: boolean;
      next?: boolean;
      nextRouter?: string;
      vite?: boolean;
      reactRouter?: boolean;
      stateLibs?: string[];
    };
  };
  components: Asset[];
  hooks: Asset[];
  utils: Asset[];
  contexts: Asset[];
  routes: Asset[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  deadCode: Record<string, unknown[]>;
  dependencies?: DependencyReport;
  staticAssets?: StaticAssetReport;
  search: SearchRecord[];
  stats: Stats;
}

export const TYPE_COLORS: Record<string, string> = {
  component: '#2e9bff',
  hook: '#a78bfa',
  utility: '#3ddc84',
  context: '#f59e0b',
  store: '#fb7185',
  provider: '#ff8ec7',
  route: '#c084fc',
  file: '#6b6963',
  external: '#403e3a',
};
