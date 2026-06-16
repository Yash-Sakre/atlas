import { useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { FiRefreshCw, FiMaximize, FiShare2, FiFolder } from 'react-icons/fi';
import { useData } from '../data';
import { TYPE_COLORS, type GraphEdge, type GraphNode } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EDGE_COLORS: Record<string, string> = {
  imports: '#5a5852',
  renders: '#2e9bff',
  uses: '#3ddc84',
  provides: '#fb7185',
};

const EDGE_LABELS: Record<string, string> = {
  imports: 'imports',
  renders: 'renders',
  uses: 'uses',
  provides: 'provides',
};

const DEFAULT_DEPTH = 2;
const ROOT_MAX_NODES = 200;
const ALL_MAX_NODES = 600; // when exceeded, keep the most-connected nodes

const TYPE_ORDER = ['component', 'hook', 'utility', 'context', 'store', 'provider', 'route', 'file', 'external'];

type Mode = 'all' | 'folders' | 'root';
type LayoutKind = 'graph' | 'lanes';

/** A node descriptor independent of ReactFlow — drives layout + rendering. */
interface Info {
  id: string;
  label: string;
  type: string;
  usage: number;
  isFolder?: boolean;
  count?: number; // members, for folder nodes
}
interface ViewEdge {
  from: string;
  to: string;
  kind: string;
  count?: number; // aggregated, for folder edges
}

interface NodeData {
  label: string;
  type: string;
  isRoot?: boolean;
  isFolder?: boolean;
  count?: number;
  lane?: string;
}

function AtlasNode({ data }: NodeProps<NodeData>) {
  if (data.lane) {
    return <div className="atlas-lane-label">{data.lane}</div>;
  }
  return (
    <div
      className={`atlas-node atlas-node--${data.type}${data.isRoot ? ' is-root' : ''}${data.isFolder ? ' is-folder' : ''}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.isFolder ? <FiFolder className="atlas-node-folder" /> : <span className="atlas-node-dot" />}
      <span className="atlas-node-label" title={data.label}>
        {data.label}
      </span>
      {data.isFolder && <span className="atlas-node-count">{data.count}</span>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { atlas: AtlasNode };

/** Directory of a path: "src/components/Button.tsx" → "src/components". */
function folderOf(path?: string): string {
  if (!path) return '(external)';
  const norm = path.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i < 0 ? '(root)' : norm.slice(0, i) || '(root)';
}

export default function TreeView() {
  const data = useData();
  const g = data.graph || { nodes: [], edges: [] };
  const flowRef = useRef<HTMLDivElement>(null);

  const { byId, adj, defaultRoot, searchItems, allTypes, allKinds } = useMemo(() => {
    const byIdMap: Record<string, GraphNode> = {};
    g.nodes.forEach((n) => (byIdMap[n.id] = n));
    const adjMap: Record<string, GraphEdge[]> = {};
    g.edges.forEach((e) => (adjMap[e.from] = adjMap[e.from] || []).push(e));
    let root = g.nodes[0]?.id ?? '';
    let best = -1;
    g.nodes.forEach((n) => {
      const d = (adjMap[n.id] || []).length;
      if (d > best) {
        best = d;
        root = n.id;
      }
    });
    const items = g.nodes.map((n) => ({ id: n.id, label: n.label || n.id, path: n.path || '', type: n.type }));
    const typesPresent = new Set(g.nodes.map((n) => n.type));
    const types = TYPE_ORDER.filter((t) => typesPresent.has(t as GraphNode['type']));
    const kinds = Array.from(new Set(g.edges.map((e) => e.kind)));
    return { byId: byIdMap, adj: adjMap, defaultRoot: root, searchItems: items, allTypes: types, allKinds: kinds };
  }, [g]);

  const [mode, setMode] = useState<Mode>('all');
  const [layout, setLayout] = useState<LayoutKind>('graph');
  const [rootId, setRootId] = useState(defaultRoot);
  const [depth, setDepth] = useState(DEFAULT_DEPTH);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [hideIsolated, setHideIsolated] = useState(true);
  const [minUsage, setMinUsage] = useState(0);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // ── Build the displayed graph (positions + base styling, no focus dimming) ──
  const view = useMemo(
    () =>
      buildView({
        g,
        byId,
        adj,
        mode,
        layout,
        rootId,
        depth,
        hiddenTypes,
        hiddenKinds,
        hideIsolated,
        minUsage,
        folderFilter,
        allTypes,
      }),
    [g, byId, adj, mode, layout, rootId, depth, hiddenTypes, hiddenKinds, hideIsolated, minUsage, folderFilter, allTypes],
  );

  // ── Apply click-to-focus highlighting on top of the base graph (cheap) ──
  const focusSet = useMemo(() => {
    if (!focusId) return null;
    const s = view.adjacency.get(focusId);
    return s ? new Set([focusId, ...s]) : null;
  }, [focusId, view]);

  const nodes = useMemo<Node[]>(() => {
    if (!focusSet) return view.nodes;
    return view.nodes.map((n) =>
      n.data?.lane ? n : { ...n, style: { ...n.style, opacity: focusSet.has(n.id) ? 1 : 0.1 } },
    );
  }, [view, focusSet]);

  const edges = useMemo<Edge[]>(() => {
    if (!focusId) return view.edges;
    return view.edges.map((e) => {
      const on = e.source === focusId || e.target === focusId;
      return { ...e, style: { ...e.style, opacity: on ? 1 : 0.05 }, zIndex: on ? 10 : 0 };
    });
  }, [view, focusId]);

  const ql = query.trim().toLowerCase();
  const results = ql
    ? searchItems
        .filter((it) => it.label.toLowerCase().includes(ql) || it.path.toLowerCase().includes(ql))
        .slice(0, 14)
    : [];

  const enabledTypes = allTypes.filter((t) => !hiddenTypes.has(t));
  const enabledKinds = allKinds.filter((k) => !hiddenKinds.has(k));
  const onTypesChange = (v: string[]) => setHiddenTypes(new Set(allTypes.filter((t) => !v.includes(t))));
  const onKindsChange = (v: string[]) => setHiddenKinds(new Set(allKinds.filter((k) => !v.includes(k))));

  function toggleFullscreen() {
    const el = flowRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function rootOn(id: string) {
    setRootId(id);
    setMode('root');
    setFocusId(null);
  }

  function onNodeClick(id: string) {
    if (id.startsWith('folder:')) {
      setFolderFilter(id.slice('folder:'.length));
      setMode('all');
      setFocusId(null);
      return;
    }
    setFocusId((cur) => (cur === id ? null : id)); // single click = focus/unfocus
  }

  function changeMode(m: Mode) {
    setMode(m);
    setFocusId(null);
    if (m !== 'all') setFolderFilter(null);
  }

  function resetAll() {
    setMode('all');
    setLayout('graph');
    setRootId(defaultRoot);
    setDepth(DEFAULT_DEPTH);
    setHiddenTypes(new Set());
    setHiddenKinds(new Set());
    setHideIsolated(true);
    setMinUsage(0);
    setFolderFilter(null);
    setFocusId(null);
    setQuery('');
  }

  function labelFor(id: string) {
    const n = byId[id];
    return n ? n.label || id : '';
  }

  if (!g.nodes.length) {
    return (
      <>
        <Heading />
        <div className="atlas-flow">
          <div className="atlas-flow-loading">No dependency data was extracted for this project.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Heading />
      <div className="atlas-tree-layout">
        <aside className="atlas-tree-filters">
          <div className="atlas-filter-group atlas-flow-search">
            <Input
              placeholder="Search a node to root…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
            />
            {open && results.length > 0 && (
              <div className="atlas-flow-results">
                {results.map((it) => (
                  <button
                    key={it.id}
                    className="atlas-flow-result"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      rootOn(it.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="atlas-node-dot" style={{ background: TYPE_COLORS[it.type] || TYPE_COLORS.file }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="mono" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.label}
                      </span>
                      <span className="mono p" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.path}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="atlas-filter-group">
            <span className="atlas-filter-label">View</span>
            <Tabs value={mode} onValueChange={(v) => changeMode(v as Mode)}>
              <TabsList className="flex w-full">
                <TabsTrigger value="all" className="flex-1">
                  <FiShare2 className="h-3.5 w-3.5" /> All
                </TabsTrigger>
                <TabsTrigger value="folders" className="flex-1">
                  Folders
                </TabsTrigger>
                <TabsTrigger value="root" className="flex-1">
                  Rooted
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {folderFilter && mode === 'all' && (
              <div className="atlas-flow-root" style={{ marginTop: 8 }}>
                Folder: <span className="mono" style={{ color: 'var(--ink-muted)' }}>{folderFilter}</span>{' '}
                <button className="atlas-filter-clear" onClick={() => setFolderFilter(null)}>
                  clear
                </button>
              </div>
            )}

            {mode === 'root' && (
              <>
                <div className="atlas-flow-root" title={labelFor(rootId)} style={{ marginTop: 8 }}>
                  Root: <span style={{ color: 'var(--ink-muted)' }}>{labelFor(rootId)}</span>
                </div>
                <Select value={String(depth)} onValueChange={(v) => setDepth(parseInt(v, 10))}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Depth {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {mode !== 'folders' && (
            <div className="atlas-filter-group">
              <span className="atlas-filter-label">Layout</span>
              <Tabs value={layout} onValueChange={(v) => setLayout(v as LayoutKind)}>
                <TabsList className="flex w-full">
                  <TabsTrigger value="graph" className="flex-1">
                    Graph
                  </TabsTrigger>
                  <TabsTrigger value="lanes" className="flex-1">
                    Type lanes
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="atlas-filter-group">
            <div className="atlas-filter-head">
              <span className="atlas-filter-label">Node types</span>
              {hiddenTypes.size > 0 && (
                <button className="atlas-filter-clear" onClick={() => setHiddenTypes(new Set())}>
                  reset
                </button>
              )}
            </div>
            <ToggleGroup type="multiple" value={enabledTypes} onValueChange={onTypesChange} className="flex flex-wrap gap-1.5">
              {allTypes.map((t) => (
                <ToggleGroupItem key={t} value={t} title={`Toggle ${t}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[t] || TYPE_COLORS.file }} />
                  {t}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {allKinds.length > 0 && (
            <div className="atlas-filter-group">
              <div className="atlas-filter-head">
                <span className="atlas-filter-label">Edges</span>
                {hiddenKinds.size > 0 && (
                  <button className="atlas-filter-clear" onClick={() => setHiddenKinds(new Set())}>
                    reset
                  </button>
                )}
              </div>
              <ToggleGroup type="multiple" value={enabledKinds} onValueChange={onKindsChange} className="flex flex-wrap gap-1.5">
                {allKinds.map((k) => (
                  <ToggleGroupItem key={k} value={k} title={`Toggle ${k} edges`}>
                    <span className="h-0.5 w-3 shrink-0 rounded-sm" style={{ background: EDGE_COLORS[k] || '#403e3a' }} />
                    {EDGE_LABELS[k] || k}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {mode !== 'folders' && (
            <div className="atlas-filter-group">
              <span className="atlas-filter-label">Declutter</span>
              <ToggleGroup
                type="multiple"
                value={hideIsolated ? ['iso'] : []}
                onValueChange={(v) => setHideIsolated(v.includes('iso'))}
              >
                <ToggleGroupItem value="iso" title="Hide nodes with no visible connections">
                  Hide isolated
                </ToggleGroupItem>
              </ToggleGroup>
              <Select value={String(minUsage)} onValueChange={(v) => setMinUsage(parseInt(v, 10))}>
                <SelectTrigger className="w-full">
                  <span className="atlas-faint" style={{ fontSize: 12 }}>Min usage:&nbsp;</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 5, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? 'any' : `≥ ${n}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="atlas-filter-foot">
            <span className="atlas-faint" style={{ fontSize: 12 }}>
              {view.note}
            </span>
            <Button variant="secondary" size="sm" onClick={resetAll} title="Reset view & filters">
              <FiRefreshCw className="h-[15px] w-[15px]" />
              Reset
            </Button>
          </div>
        </aside>

        <div className="atlas-flow" ref={flowRef}>
          {view.nodes.length === 0 ? (
            <div className="atlas-flow-loading">No nodes match the current filters.</div>
          ) : (
            <ReactFlow
              key={`${mode}|${layout}|${rootId}|${depth}|${hiddenTypes.size}|${hiddenKinds.size}|${hideIsolated}|${minUsage}|${folderFilter}`}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.04}
              maxZoom={1.6}
              nodesConnectable={false}
              onlyRenderVisibleElements
              onNodeClick={(_, n) => onNodeClick(n.id)}
              onNodeDoubleClick={(_, n) => !n.id.startsWith('folder:') && rootOn(n.id)}
              onPaneClick={() => setFocusId(null)}
              defaultEdgeOptions={{ type: 'smoothstep' }}
            >
              <Background color="#2a2824" gap={22} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => TYPE_COLORS[(n.data as NodeData)?.type] || TYPE_COLORS.file}
                maskColor="rgba(10,9,8,0.72)"
              />
              <Panel position="top-right">
                <Button variant="secondary" size="sm" onClick={toggleFullscreen} title="Toggle fullscreen">
                  <FiMaximize className="h-[15px] w-[15px]" />
                  Fullscreen
                </Button>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </div>
      <p className="atlas-faint mt-3" style={{ fontSize: 13 }}>
        <strong style={{ color: 'var(--ink-muted)' }}>Click</strong> a node to focus its neighbors ·{' '}
        <strong style={{ color: 'var(--ink-muted)' }}>double-click</strong> to root the tree on it ·{' '}
        <strong style={{ color: 'var(--ink-muted)' }}>Folders</strong> view collapses by directory (click a folder to
        drill in). Scroll to zoom, drag to pan.
      </p>
    </>
  );
}

function Heading() {
  return (
    <div className="mb-6">
      <p className="atlas-eyebrow">Relationships</p>
      <h1 className="atlas-page-title">Dependency Tree</h1>
      <p className="atlas-lead">
        Explore the dependency graph at any scale — group by folder, lay out in type lanes, prune the
        noise, click a node to focus its neighbors, or root the tree on it.
      </p>
    </div>
  );
}

// ──────────────────────────────── builders ─────────────────────────────────

interface BuildArgs {
  g: { nodes: GraphNode[]; edges: GraphEdge[] };
  byId: Record<string, GraphNode>;
  adj: Record<string, GraphEdge[]>;
  mode: Mode;
  layout: LayoutKind;
  rootId: string;
  depth: number;
  hiddenTypes: Set<string>;
  hiddenKinds: Set<string>;
  hideIsolated: boolean;
  minUsage: number;
  folderFilter: string | null;
  allTypes: string[];
}

interface ViewResult {
  nodes: Node[];
  edges: Edge[];
  adjacency: Map<string, Set<string>>;
  note: string;
}

function buildView(a: BuildArgs): ViewResult {
  if (a.mode === 'folders') return buildFolders(a);
  if (a.mode === 'root') return buildRooted(a);
  return buildAll(a);
}

/** The whole graph, filtered + pruned, capped by connectivity. */
function buildAll(a: BuildArgs): ViewResult {
  const { g, hiddenTypes, hiddenKinds, hideIsolated, minUsage, folderFilter } = a;
  let eligible = g.nodes.filter(
    (n) =>
      !hiddenTypes.has(n.type) &&
      (n.usageCount ?? 0) >= minUsage &&
      (!folderFilter || folderOf(n.path) === folderFilter),
  );
  const total = g.nodes.length;

  // Degree over the (kind-filtered) graph, used for pruning + capping.
  const eligibleIds = new Set(eligible.map((n) => n.id));
  const degree = new Map<string, number>();
  const keptEdges: GraphEdge[] = [];
  const seenE = new Set<string>();
  for (const e of g.edges) {
    if (hiddenKinds.has(e.kind) || !eligibleIds.has(e.from) || !eligibleIds.has(e.to)) continue;
    const k = `${e.from}>${e.to}>${e.kind}`;
    if (seenE.has(k)) continue;
    seenE.add(k);
    keptEdges.push(e);
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }

  if (hideIsolated) eligible = eligible.filter((n) => (degree.get(n.id) || 0) > 0);

  let capped = false;
  if (eligible.length > ALL_MAX_NODES) {
    eligible = [...eligible].sort((x, y) => (degree.get(y.id) || 0) - (degree.get(x.id) || 0)).slice(0, ALL_MAX_NODES);
    capped = true;
  }

  const keepIds = new Set(eligible.map((n) => n.id));
  const info: Info[] = eligible.map((n) => ({ id: n.id, label: n.label || n.id, type: n.type, usage: n.usageCount ?? 0 }));
  const edges = keptEdges.filter((e) => keepIds.has(e.from) && keepIds.has(e.to));

  const note =
    (folderFilter ? `${folderFilter} · ` : '') +
    `${info.length} of ${total} nodes` +
    (capped ? ` · top ${ALL_MAX_NODES} by connections` : '');
  return assemble(info, edges, a, '', note);
}

/** Collapse every node into its directory; edges aggregate between folders. */
function buildFolders(a: BuildArgs): ViewResult {
  const { g, hiddenTypes, hiddenKinds } = a;
  const folderMembers = new Map<string, GraphNode[]>();
  for (const n of g.nodes) {
    if (hiddenTypes.has(n.type)) continue;
    const f = folderOf(n.path);
    (folderMembers.get(f) || folderMembers.set(f, []).get(f)!).push(n);
  }
  const folderOfNode = new Map<string, string>();
  g.nodes.forEach((n) => folderOfNode.set(n.id, folderOf(n.path)));

  const info: Info[] = [];
  for (const [folder, members] of folderMembers) {
    const counts = new Map<string, number>();
    members.forEach((m) => counts.set(m.type, (counts.get(m.type) || 0) + 1));
    const domType = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || 'file';
    info.push({ id: `folder:${folder}`, label: folder, type: domType, usage: 0, isFolder: true, count: members.length });
  }

  // Aggregate inter-folder edges.
  const agg = new Map<string, ViewEdge>();
  for (const e of g.edges) {
    if (hiddenKinds.has(e.kind)) continue;
    const ff = folderOfNode.get(e.from);
    const ft = folderOfNode.get(e.to);
    if (!ff || !ft || ff === ft) continue; // skip intra-folder
    if (!folderMembers.has(ff) || !folderMembers.has(ft)) continue;
    const key = `${ff}>${ft}`;
    const cur = agg.get(key);
    if (cur) cur.count = (cur.count || 1) + 1;
    else agg.set(key, { from: `folder:${ff}`, to: `folder:${ft}`, kind: e.kind, count: 1 });
  }
  const edges = [...agg.values()];
  const note = `${info.length} folders · ${g.nodes.length} nodes`;
  return assemble(info, edges, a, '', note);
}

/** BFS from a root over outgoing edges (filters applied), then layout. */
function buildRooted(a: BuildArgs): ViewResult {
  const { rootId, depth, byId, adj, hiddenTypes, hiddenKinds } = a;
  if (!rootId || !byId[rootId]) return { nodes: [], edges: [], adjacency: new Map(), note: '0 nodes' };
  const seen = new Set<string>([rootId]);
  const keep = [rootId];
  let frontier = [rootId];
  let d = 0;
  const uniq: GraphEdge[] = [];
  const es = new Set<string>();
  while (frontier.length && d < depth && keep.length < ROOT_MAX_NODES) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adj[id] || []) {
        if (!byId[e.to] || hiddenKinds.has(e.kind)) continue;
        if (e.to !== rootId && hiddenTypes.has(byId[e.to].type)) continue;
        const k = `${e.from}>${e.to}>${e.kind}`;
        if (!es.has(k)) {
          es.add(k);
          uniq.push(e);
        }
        if (!seen.has(e.to)) {
          seen.add(e.to);
          keep.push(e.to);
          next.push(e.to);
          if (keep.length >= ROOT_MAX_NODES) break;
        }
      }
      if (keep.length >= ROOT_MAX_NODES) break;
    }
    frontier = next;
    d++;
  }
  const info: Info[] = keep.map((id) => {
    const n = byId[id];
    return { id, label: n.label || id, type: n.type, usage: n.usageCount ?? 0 };
  });
  const edges = uniq.filter((e) => seen.has(e.from) && seen.has(e.to));
  return assemble(info, edges, a, rootId, `${info.length} nodes from root`);
}

/** Lay out an Info[] + edges (dagre or type-lanes) and build ReactFlow nodes/edges. */
function assemble(info: Info[], edges: ViewEdge[], a: BuildArgs, rootId: string, note: string): ViewResult {
  const W = 196;
  const H = 38;
  const pos: Record<string, { x: number; y: number }> = {};
  const laneHeaders: Node[] = [];

  if (a.layout === 'lanes' && a.mode !== 'folders') {
    const COL_W = 240;
    const ROW_H = 50;
    const M = 30;
    const byType: Record<string, Info[]> = {};
    info.forEach((n) => (byType[n.type] = byType[n.type] || []).push(n));
    const cols = a.allTypes.filter((t) => byType[t]?.length);
    cols.forEach((t, ci) => {
      const list = byType[t].sort((x, y) => y.usage - x.usage || x.label.localeCompare(y.label));
      list.forEach((n, ri) => (pos[n.id] = { x: M + ci * COL_W, y: M + 28 + ri * ROW_H }));
      laneHeaders.push({
        id: `lane:${t}`,
        type: 'atlas',
        position: { x: M + ci * COL_W, y: 0 },
        data: { lane: t, label: t, type: t },
        draggable: false,
        selectable: false,
      });
    });
  } else {
    const dg = new dagre.graphlib.Graph();
    dg.setDefaultEdgeLabel(() => ({}));
    dg.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 140, marginx: 24, marginy: 24 });
    info.forEach((n) => dg.setNode(n.id, { width: W, height: H }));
    const de = new Set<string>();
    edges.forEach((e) => {
      const p = `${e.from}>${e.to}`;
      if (!de.has(p)) {
        de.add(p);
        dg.setEdge(e.from, e.to);
      }
    });
    dagre.layout(dg);
    info.forEach((n) => {
      const p = dg.node(n.id);
      pos[n.id] = { x: p.x - W / 2, y: p.y - H / 2 };
    });
  }

  const rfNodes: Node[] = info.map((n) => ({
    id: n.id,
    type: 'atlas',
    position: pos[n.id] || { x: 0, y: 0 },
    data: { label: n.label, type: n.type, isRoot: n.id === rootId, isFolder: n.isFolder, count: n.count },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const adjacency = new Map<string, Set<string>>();
  const rfEdges: Edge[] = edges.map((e, i) => {
    const c = EDGE_COLORS[e.kind] || '#5a5852';
    (adjacency.get(e.from) || adjacency.set(e.from, new Set()).get(e.from)!).add(e.to);
    (adjacency.get(e.to) || adjacency.set(e.to, new Set()).get(e.to)!).add(e.from);
    const w = e.count && e.count > 1 ? Math.min(1.2 + Math.log2(e.count), 5) : 1.5;
    return {
      id: `e${i}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      style: { stroke: c, strokeWidth: w },
      label: e.count && e.count > 1 ? String(e.count) : undefined,
      labelStyle: { fill: 'var(--ink-faint)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--surface-1)' },
      markerEnd: { type: MarkerType.ArrowClosed, color: c, width: 15, height: 15 },
    };
  });

  return { nodes: [...laneHeaders, ...rfNodes], edges: rfEdges, adjacency, note };
}
