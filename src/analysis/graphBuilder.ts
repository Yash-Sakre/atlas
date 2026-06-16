/** Builds the asset dependency graph from resolved dependencies + JSX renders. */
import type { Asset, DependencyGraph, GraphEdge, GraphNode } from '../core/types';
import { makeId } from '../extractors/ast-utils';

export function buildGraph(assets: Asset[]): DependencyGraph {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const nodes: GraphNode[] = assets.map((a) => ({
    id: a.id,
    label: a.name,
    type: a.type,
    path: a.path,
    usageCount: a.usageCount,
  }));

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (from: string, to: string, kind: GraphEdge['kind']) => {
    if (from === to) return;
    const key = `${from}->${to}:${kind}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from, to, kind });
  };

  // name → ids (for resolving JSX render references by component name)
  const byName = new Map<string, string[]>();
  for (const a of assets) {
    const arr = byName.get(a.name) ?? [];
    arr.push(a.id);
    byName.set(a.name, arr);
  }

  for (const a of assets) {
    for (const depId of a.dependencies) {
      if (byId.has(depId)) add(a.id, depId, 'uses');
    }
    if (a.type === 'component') {
      for (const rendered of a.rendersComponents) {
        const targets = byName.get(rendered);
        if (targets) for (const t of targets) add(a.id, t, 'renders');
      }
    }
  }

  return { nodes, edges };
}

/** "Most used" ranking helper used by the CLI summary. */
export function rankByUsage(assets: Asset[], limit = 10): Asset[] {
  return [...assets].sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

export { makeId };
