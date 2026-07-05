import { useEffect, useMemo, useState } from 'react';
import { FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset } from '../types';
import { SearchField, TypeBadge } from '../ui';
import Detail from './Detail';

function RouteLabel({ route }: { route: Asset }) {
  return (
    <>
      <TypeBadge type="route" />
      <span className="atlas-tree-node-label" style={{ color: 'var(--t-route)' }}>
        {route.routePath || route.name}
      </span>
      {route.segmentKind && (
        <span className="atlas-faint mono" style={{ fontSize: 10 }}>
          [{route.segmentKind}]
        </span>
      )}
      {route.componentName && (
        <>
          <span className="atlas-faint">→</span>
          <span className="mono atlas-tree-node-label" style={{ color: 'var(--t-component)' }}>
            {route.componentName}
          </span>
        </>
      )}
    </>
  );
}

/** A route plus its already-resolved children — a pure tree, built once in useMemo. */
interface RouteTreeNode {
  route: Asset;
  children: RouteTreeNode[];
}

/** Pure recursive renderer — no side effects, so it's StrictMode-safe. */
function RouteTree({
  nodes,
  onSelect,
  selectedId,
}: {
  nodes: RouteTreeNode[];
  onSelect: (a: Asset) => void;
  selectedId: string | null;
}) {
  return (
    <ul className="atlas-tree">
      {nodes.map((n) => (
        <li key={n.route.id}>
          <button
            className={`atlas-tree-node${n.route.id === selectedId ? ' is-active' : ''}`}
            onClick={() => onSelect(n.route)}
          >
            <RouteLabel route={n.route} />
          </button>
          {n.children.length > 0 && (
            <RouteTree nodes={n.children} onSelect={onSelect} selectedId={selectedId} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function RoutesView() {
  const data = useData();
  const routes = data.routes || [];
  const [selected, setSelected] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');

  const tree = useMemo(() => {
    const byPathMap: Record<string, Asset> = {};
    routes.forEach((r) => {
      if (r.routePath) byPathMap[r.routePath] = r;
    });
    const childPaths = new Set<string>();
    routes.forEach((r) => (r.childRoutes || []).forEach((c) => childPaths.add(c)));
    let rootList = routes.filter((r) => !r.routePath || !childPaths.has(r.routePath));
    if (!rootList.length) rootList = routes;

    // Resolve the nested structure once here (cycle-guarded), so rendering stays pure.
    const seen = new Set<string>();
    const build = (r: Asset): RouteTreeNode | null => {
      if (seen.has(r.id)) return null;
      seen.add(r.id);
      const children = (r.childRoutes || [])
        .map((c) => byPathMap[c])
        .filter(Boolean)
        .map(build)
        .filter(Boolean) as RouteTreeNode[];
      return { route: r, children };
    };
    return rootList.map(build).filter(Boolean) as RouteTreeNode[];
  }, [routes]);

  // Auto-select the first route on wide screens so the detail pane isn't empty.
  useEffect(() => {
    const isNarrow = window.matchMedia('(max-width: 900px)').matches;
    if (!selected && !isNarrow && tree.length) setSelected(tree[0].route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ql = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!ql) return [];
    return routes.filter((r) =>
      [r.routePath, r.name, r.componentName, r.path]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(ql)),
    );
  }, [ql, routes]);

  return (
    <>
      <div className="atlas-pagehead">
        <div className="atlas-pagehead-main">
          <h1 className="atlas-pagehead-title">Routes</h1>
          <p className="atlas-pagehead-sub">Route tree discovered from the router configuration</p>
        </div>
        <div className="atlas-pagehead-side">
          <span className="atlas-pill tnum">{routes.length} routes</span>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="atlas-empty atlas-card" style={{ padding: 48 }}>
          <FiInbox size={28} strokeWidth={1.5} />
          <p>No routes found in this project.</p>
        </div>
      ) : (
        <div className="atlas-split">
          <aside className="atlas-side">
            <div className="atlas-filterbar">
              <SearchField value={query} onChange={setQuery} placeholder="Filter routes…" />
              <span className="atlas-filter-count">
                <b>{ql ? matches.length : routes.length}</b> / {routes.length}
              </span>
            </div>
            <div className="atlas-side-list" style={{ paddingTop: 4 }}>
              {ql ? (
                matches.length === 0 ? (
                  <div className="atlas-empty">No routes match “{query}”.</div>
                ) : (
                  <ul className="atlas-tree atlas-tree--flat">
                    {matches.map((r) => (
                      <li key={r.id}>
                        <button
                          className={`atlas-tree-node${r.id === selected?.id ? ' is-active' : ''}`}
                          onClick={() => setSelected(r)}
                        >
                          <RouteLabel route={r} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <RouteTree nodes={tree} onSelect={setSelected} selectedId={selected?.id || null} />
              )}
            </div>
          </aside>

          <section className="atlas-detail atlas-card">
            {selected ? (
              <Detail asset={selected} />
            ) : (
              <div className="atlas-detail-empty">
                <FiInbox size={32} strokeWidth={1.5} />
                <p>Select a route to view its details</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
