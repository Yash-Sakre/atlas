/** Extractor registry: the built-in set, runnable per source file. */
import type { Asset, Extractor, ExtractionContext } from '../core/types';
import { rel } from '../core/project';
import { ComponentExtractor } from './componentExtractor';
import { HookExtractor } from './hookExtractor';
import { UtilExtractor } from './utilExtractor';
import { ContextExtractor } from './contextExtractor';
import { RouteExtractor } from './routeExtractor';

export function builtinExtractors(): Extractor[] {
  return [
    new ComponentExtractor(),
    new HookExtractor(),
    new ContextExtractor(),
    new RouteExtractor(),
    // Utility runs LAST so it can defer to the more specific extractors above
    // (it already self-excludes components/hooks, but ordering keeps intent clear).
    new UtilExtractor(),
  ];
}

/**
 * Run every extractor over one source file, with de-dup so the same symbol is
 * not claimed by two extractors. Component/Hook/Context win over Utility.
 */
export function runExtractors(
  extractors: Extractor[],
  ctx: ExtractionContext,
  onFile?: (assets: Asset[], relPath: string) => void,
): Asset[] {
  const all: Asset[] = [];
  for (const file of ctx.sourceFiles) {
    const relPath = rel(ctx.root, file.getFilePath());
    const perFile: Asset[] = [];
    const claimed = new Set<string>();
    for (const ex of extractors) {
      let produced: Asset[] = [];
      try {
        produced = ex.extract(file, ctx);
      } catch {
        produced = [];
      }
      for (const asset of produced) {
        // De-dup by name within a file; first (more specific) extractor wins,
        // EXCEPT routes which are keyed by route path and may legitimately repeat.
        const key = asset.type === 'route' ? asset.id : asset.name;
        if (claimed.has(key)) continue;
        claimed.add(key);
        perFile.push(asset);
      }
    }
    if (perFile.length) {
      all.push(...perFile);
      onFile?.(perFile, relPath);
    }
  }
  return all;
}

export {
  ComponentExtractor,
  HookExtractor,
  UtilExtractor,
  ContextExtractor,
  RouteExtractor,
};
