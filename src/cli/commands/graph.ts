import { loadConfig } from '../../core/config';
import { loadOrAnalyze } from '../loadResult';
import { logger, pc } from '../../utils/logger';
import type { AnalysisResult, GraphEdge } from '../../core/types';

export async function graphCommand(flags: { root: string; outDir?: string; json?: boolean }): Promise<void> {
  const config = loadConfig(flags.root, { outDir: flags.outDir });
  const result = await loadOrAnalyze(config);

  if (flags.json) {
    logger.raw(JSON.stringify(result.graph, null, 2));
    return;
  }

  logger.banner('Dependency Graph');
  logger.table([
    ['Nodes', result.graph.nodes.length],
    ['Edges', result.graph.edges.length],
  ]);
  logger.newline();
  printTree(result);
}

/** ASCII tree rooted at entry/most-connected components. */
function printTree(result: AnalysisResult): void {
  const childrenOf = new Map<string, GraphEdge[]>();
  const inDegree = new Map<string, number>();
  for (const n of result.graph.nodes) inDegree.set(n.id, 0);
  for (const e of result.graph.edges) {
    (childrenOf.get(e.from) ?? childrenOf.set(e.from, []).get(e.from)!).push(e);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }
  const labelOf = new Map(result.graph.nodes.map((n) => [n.id, `${n.label} ${pc.dim(`(${n.type})`)}`]));

  // Roots: components nobody depends on (entry-ish), prefer those that render others.
  const roots = result.graph.nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0 && (childrenOf.get(n.id)?.length ?? 0) > 0)
    .sort((a, b) => (childrenOf.get(b.id)?.length ?? 0) - (childrenOf.get(a.id)?.length ?? 0));

  if (roots.length === 0) {
    logger.step('No clear root nodes (graph may be flat or cyclic).');
    return;
  }

  const seen = new Set<string>();
  const walk = (id: string, prefix: string, isLast: boolean, depth: number) => {
    const connector = depth === 0 ? '' : isLast ? '└─ ' : '├─ ';
    logger.raw(prefix + connector + (labelOf.get(id) ?? id));
    if (seen.has(id) || depth > 6) return;
    seen.add(id);
    const kidsSeen = new Set<string>();
    const kids = (childrenOf.get(id) ?? [])
      .filter((e) => e.kind === 'renders' || e.kind === 'uses')
      .filter((e) => (kidsSeen.has(e.to) ? false : (kidsSeen.add(e.to), true)));
    const childPrefix = prefix + (depth === 0 ? '' : isLast ? '   ' : '│  ');
    kids.forEach((e, i) => walk(e.to, childPrefix, i === kids.length - 1, depth + 1));
  };

  for (const root of roots.slice(0, 8)) walk(root.id, '', true, 0);
}
