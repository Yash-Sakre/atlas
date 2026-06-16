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
  unusedExports: number;
  duplicateCandidates: number;
  durationMs: number;
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
