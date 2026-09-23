/**
 * Core type contract for Atlas.
 *
 * The analysis output shapes (assets, graph, reports, `AnalysisResult`) live in
 * `@codebase-atlas/schema`, shared with the dashboard, and are re-exported here
 * so the rest of the CLI keeps importing from one place. This file adds the
 * CLI-internal types: config, the extraction context, extractors and plugins.
 * Keep it dependency-free (only `ts-morph` types are allowed) so it can be
 * imported from anywhere.
 */
import type { Project, SourceFile } from 'ts-morph';
import type { AnalysisResult, Asset, AssetType, FrameworkInfo } from '@codebase-atlas/schema';

export type * from '@codebase-atlas/schema';

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
