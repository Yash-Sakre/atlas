/**
 * Orchestrator: the end-to-end analyze pipeline.
 *
 *   load project → run extractors (cache + plugins) → resolve usage →
 *   build graph → dead-code → architecture → AI/heuristic docs → search index.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  AnalysisResult,
  Asset,
  ComponentAsset,
  ContextAsset,
  Extractor,
  HookAsset,
  Plugin,
  ResolvedConfig,
  RouteAsset,
  UtilAsset,
} from './types';
import { loadProject, rel } from './project';
import { builtinExtractors } from '../extractors';
import { analyzeUsage } from '../analysis/usageAnalyzer';
import { buildGraph } from '../analysis/graphBuilder';
import { analyzeDeadCode } from '../analysis/deadCode';
import { analyzeArchitecture } from '../analysis/architecture';
import { describeAssets } from '../ai/describe';
import { buildSearchIndex } from '../search/searchIndex';
import { loadPlugins } from '../plugins/loader';
import { IncrementalCache, cachePathFor } from '../utils/cache';

export interface AnalyzeHooks {
  onPhase?: (phase: string) => void;
  /** Fires as files are scanned during extraction (the slow phase). */
  onExtractProgress?: (done: number, total: number) => void;
  onDescribeProgress?: (done: number, total: number) => void;
  /** Skip the documentation phase. */
  skipDocs?: boolean;
}

/** Yield the event loop so a CPU-bound loop doesn't freeze timers (e.g. the CLI spinner). */
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export async function runAnalysis(config: ResolvedConfig, hooks: AnalyzeHooks = {}): Promise<AnalysisResult> {
  const started = Date.now();
  const phase = (p: string) => hooks.onPhase?.(p);

  phase('Loading project');
  const { ctx, sourceFiles } = loadProject(config);

  phase('Loading plugins');
  const plugins: Plugin[] = await loadPlugins(config);
  const extractors: Extractor[] = [...builtinExtractors(), ...plugins.flatMap((p) => p.extractors ?? [])];

  phase('Extracting assets');
  const cache = new IncrementalCache(cachePathFor(config.root, config.outDir), config.cache);
  const assets = await extractWithCache(extractors, ctx, cache, hooks.onExtractProgress);
  cache.prune(new Set(sourceFiles.map((f) => rel(config.root, f.getFilePath()))));
  if (config.cache) cache.flush();

  phase('Resolving exports');
  resolveDefaultExports(assets, ctx);

  phase('Analyzing usage');
  analyzeUsage(assets, ctx);

  const components = assets.filter((a): a is ComponentAsset => a.type === 'component');
  const hooksList = assets.filter((a): a is HookAsset => a.type === 'hook');
  const utils = assets.filter((a): a is UtilAsset => a.type === 'utility');
  const contexts = assets.filter(
    (a): a is ContextAsset => a.type === 'context' || a.type === 'store' || a.type === 'provider',
  );
  const routes = assets.filter((a): a is RouteAsset => a.type === 'route');

  phase('Building graph');
  const graph = buildGraph(assets);

  phase('Detecting dead code');
  const deadCode = analyzeDeadCode(assets, routes, ctx);

  phase('Analyzing architecture');
  const architecture = analyzeArchitecture(assets, config);

  if (!hooks.skipDocs) {
    phase('Generating documentation');
    const undocumented = assets.filter((a) => !a.description);
    if (undocumented.length) hooks.onDescribeProgress?.(0, undocumented.length);
    await describeAssets(undocumented, hooks.onDescribeProgress);
  }

  phase('Building search index');
  const search = buildSearchIndex(assets);

  const result: AnalysisResult = {
    meta: {
      generatedAt: new Date(started).toISOString(),
      toolVersion: toolVersion(),
      root: config.root,
      framework: ctx.framework,
      workspaces: [...new Set(assets.map((a) => a.workspace).filter((w): w is string => Boolean(w)))],
    },
    components,
    hooks: hooksList,
    utils,
    contexts,
    routes,
    graph,
    deadCode,
    architecture,
    search,
    stats: {
      fileCount: sourceFiles.length,
      components: components.length,
      hooks: hooksList.length,
      utils: utils.length,
      contexts: contexts.length,
      routes: routes.length,
      unusedExports: deadCode.deadExports.length,
      duplicateCandidates: deadCode.duplicateCandidates.length,
      durationMs: Date.now() - started,
    },
  };

  // Let plugins enrich the final result.
  for (const p of plugins) {
    if (p.enrich) await p.enrich(result, ctx);
  }

  return result;
}

async function extractWithCache(
  extractors: Extractor[],
  ctx: ExtractionContextLike,
  cache: IncrementalCache,
  onProgress?: (done: number, total: number) => void,
): Promise<Asset[]> {
  const all: Asset[] = [];
  const total = ctx.sourceFiles.length;
  let done = 0;
  for (const file of ctx.sourceFiles) {
    // Forget the ts-morph node/symbol/type wrappers created while extracting this
    // file once we're done with it. Prop extraction invokes the type checker
    // (param.getType().getProperties(), getTypeAtLocation, …), and ts-morph
    // otherwise retains every wrapper for the life of the Project — on a large
    // repo that grows unbounded and OOMs the heap within a few dozen files.
    // Assets hold only plain serializable data, so nothing live is dropped; later
    // passes (usage, default-export resolution) simply re-wrap on demand.
    ctx.project.forgetNodesCreatedInBlock(() => {
      const abs = file.getFilePath();
      const relPath = rel(ctx.root, abs);
      const content = file.getFullText();

      const cached = cache.get(relPath, abs, content);
      if (cached) {
        all.push(...(cached as Asset[]));
      } else {
        const perFile: Asset[] = [];
        const claimed = new Set<string>();
        for (const ex of extractors) {
          let produced: Asset[] = [];
          try {
            produced = ex.extract(file, ctx as any);
          } catch {
            produced = [];
          }
          for (const asset of produced) {
            const key = asset.type === 'route' ? asset.id : asset.name;
            if (claimed.has(key)) continue;
            claimed.add(key);
            perFile.push(asset);
          }
        }
        cache.set(relPath, abs, content, perFile);
        all.push(...perFile);
      }
    });

    done += 1;
    onProgress?.(done, total);
    // Yield periodically so timers (e.g. the CLI spinner) keep ticking during
    // this otherwise-synchronous, CPU-bound AST traversal.
    if (done % 20 === 0) await tick();
  }
  return all;
}

type ExtractionContextLike = ReturnType<typeof loadProject>['ctx'];

/**
 * Mark assets exported via a detached `export default X` / `export { X as default }`
 * as default exports (the extractors only see the declaration, not the later
 * export statement). Needed for Next.js pages and `const X = …; export default X`.
 */
function resolveDefaultExports(assets: Asset[], ctx: ExtractionContextLike): void {
  const byFileName = new Map<string, Asset>();
  for (const a of assets) byFileName.set(`${a.path}::${a.name}`, a);

  for (const file of ctx.sourceFiles) {
    const relPath = rel(ctx.root, file.getFilePath());
    const mark = (name: string) => {
      const a = byFileName.get(`${relPath}::${name}`);
      if (a && a.exportType === 'none') a.exportType = 'default';
    };
    for (const ea of file.getExportAssignments()) {
      if (ea.isExportEquals()) continue; // `export =` (CJS) — not a default export
      const expr = ea.getExpression();
      if (expr.getKindName() === 'Identifier') mark(expr.getText());
    }
    for (const ed of file.getExportDeclarations()) {
      for (const named of ed.getNamedExports()) {
        if (named.getAliasNode()?.getText() === 'default') mark(named.getName());
      }
    }
  }
}

function toolVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
