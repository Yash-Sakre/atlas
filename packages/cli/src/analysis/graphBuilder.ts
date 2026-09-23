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

  // name → assets (for resolving JSX render references by component name)
  const byName = new Map<string, Asset[]>();
  for (const a of assets) {
    const arr = byName.get(a.name) ?? [];
    arr.push(a);
    byName.set(a.name, arr);
  }

  // Resolve a rendered component name to a single target, preferring a match in
  // the same file, then the same workspace, then an unambiguous global match.
  // Resolving to *every* same-named asset would create false cross-file edges.
  const resolveRender = (source: Asset, name: string): string | undefined => {
    const candidates = byName.get(name);
    if (!candidates || candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0].id;
    const sameFile = candidates.find((c) => c.path === source.path);
    if (sameFile) return sameFile.id;
    const sameWs = candidates.filter((c) => c.workspace === source.workspace);
    if (sameWs.length === 1) return sameWs[0].id;
    return undefined; // ambiguous → skip rather than invent an edge
  };

  for (const a of assets) {
    for (const depId of a.dependencies) {
      if (byId.has(depId)) add(a.id, depId, 'uses');
    }
    if (a.type === 'component') {
      for (const rendered of a.rendersComponents) {
        const targetId = resolveRender(a, rendered);
        if (targetId) add(a.id, targetId, 'renders');
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
