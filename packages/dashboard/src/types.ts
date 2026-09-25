/**
 * The analyzer's output shape, as the dashboard reads it.
 *
 * Every type is derived from `@codebase-atlas/schema`, the contract the CLI
 * writes against, so a renamed or retyped field fails to compile here too. The
 * derivations deliberately loosen it: a `data.json` from an older Atlas version
 * may lack newer fields, so every view tolerates their absence.
 */
import type * as S from '@codebase-atlas/schema';

/** `T` with the keys `K` made optional. */
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Asset kinds, plus the two node kinds that only appear in the graph. */
export type AssetType = S.GraphNode['type'];

export type Description = Partial<S.AIDescription>;

/** A component prop or a function parameter. */
export type Param = Optional<S.PropInfo, 'type' | 'optional'>;

export type SourceLocation = Optional<S.SourceLocation, 'column'>;

export type UsageRef = S.UsageReference;

/** Every field of every asset kind, flattened, so views can read any of them. */
type AssetFields = Omit<S.ComponentAsset, 'type'> &
  Omit<S.HookAsset, 'type'> &
  Omit<S.UtilAsset, 'type'> &
  Omit<S.ContextAsset, 'type'> &
  Omit<S.RouteAsset, 'type'>;

export interface Asset
  extends Pick<S.BaseAsset, 'id' | 'name' | 'path'>,
    Partial<Omit<AssetFields, 'id' | 'name' | 'path' | 'description' | 'props' | 'params' | 'location'>> {
  type: AssetType;
  /** Where the symbol is declared — used for "open in editor" deep links. */
  location?: SourceLocation;
  description?: Description;
  props?: Param[];
  params?: Param[];
}

export type GraphNode = Optional<S.GraphNode, 'label' | 'path' | 'usageCount'>;

export type GraphEdge = S.GraphEdge;

export type Stats = Optional<S.AnalysisStats, 'dependencies' | 'staticAssets'>;

export type DependencyKind = S.DependencyKind;
export type DependencySource = S.DependencySource;

export type DependencyInfo = Optional<S.DependencyInfo, 'source'>;

export interface DependencyReport extends Omit<S.DependencyReport, 'dependencies'> {
  dependencies: DependencyInfo[];
}

export type StaticAssetKind = S.StaticAssetKind;

/** A static file on disk. Previews load from `path`; nothing is ever inlined. */
export type StaticAsset = Optional<S.StaticAsset, 'modified' | 'isPublic' | 'usedIn' | 'usageCount'>;

export interface StaticAssetReport {
  assets: StaticAsset[];
  counts: Omit<S.StaticAssetReport['counts'], 'byKind'> & {
    byKind: Partial<S.StaticAssetReport['counts']['byKind']>;
  };
}

export type SearchRecord = Optional<S.SearchRecord, 'description' | 'tags' | 'keywords'>;

export type DeadCodeReport = Partial<S.DeadCodeReport>;

export interface AnalysisResult {
  meta: Pick<S.AnalysisMeta, 'generatedAt' | 'toolVersion' | 'root'> & {
    framework: Partial<S.FrameworkInfo>;
  };
  components: Asset[];
  hooks: Asset[];
  utils: Asset[];
  contexts: Asset[];
  routes: Asset[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  deadCode: DeadCodeReport;
  dependencies?: DependencyReport;
  staticAssets?: StaticAssetReport;
  search: SearchRecord[];
  stats: Stats;
}

