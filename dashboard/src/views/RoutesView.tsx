import { useMemo, useState } from 'react';
import { useData } from '../data';
import type { Asset } from '../types';
import { SearchField, TypeBadge } from '../ui';
import Detail from './Detail';

function RouteNode({
  route,
  byPath,
  seen,
  onSelect,
  selectedId,
}: {
  route: Asset;
  byPath: Record<string, Asset>;
  seen: Set<string>;
  onSelect: (a: Asset) => void;
  selectedId: string | null;
}) {
  if (seen.has(route.id)) return null;
  seen.add(route.id);
  const kids = (route.childRoutes || []).map((c) => byPath[c]).filter(Boolean) as Asset[];
  return (
    <li>
      <button
        className="atlas-tree-node"
        style={route.id === selectedId ? { background: 'var(--surface-2)', borderColor: 'var(--hairline)' } : undefined}
        onClick={() => onSelect(route)}
      >
        <TypeBadge type="route" />
        <span style={{ color: '#e6a3ff' }}>{route.routePath || route.name}</span>
        {route.segmentKind && (
          <span className="atlas-faint mono" style={{ fontSize: 10, marginLeft: 2 }}>
            [{route.segmentKind}]
          </span>
        )}
        {route.componentName && (
          <>
            <span className="atlas-faint"> → </span>
            <span className="mono" style={{ color: '#7fc4ff' }}>{route.componentName}</span>
          </>
        )}
      </button>
      {kids.length > 0 && (
        <ul className="atlas-tree">
          {kids.map((k) => (
            <RouteNode
              key={k.id}
              route={k}
              byPath={byPath}
              seen={seen}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function RoutesView() {
  const data = useData();
  const routes = data.routes || [];
  const [selected, setSelected] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');

  const { roots, byPath } = useMemo(() => {
    const byPathMap: Record<string, Asset> = {};
    routes.forEach((r) => {
      if (r.routePath) byPathMap[r.routePath] = r;
    });
    const childPaths = new Set<string>();
    routes.forEach((r) => (r.childRoutes || []).forEach((c) => childPaths.add(c)));
    let rootList = routes.filter((r) => !r.routePath || !childPaths.has(r.routePath));
    if (!rootList.length) rootList = routes;
    return { roots: rootList, byPath: byPathMap };
  }, [routes]);

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
      <div className="mb-10">
        <p className="atlas-eyebrow">Navigation</p>
        <h1 className="atlas-page-title">Routes</h1>
        <p className="atlas-lead">Route tree discovered from the router configuration</p>
      </div>

      {routes.length === 0 ? (
        <div className="atlas-card" style={{ padding: 24 }}>
          <p className="atlas-faint">No routes found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="atlas-card" style={{ padding: 24 }}>
            <div className="mb-5" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchField value={query} onChange={setQuery} placeholder="Filter routes by path or component…" />
              <span className="atlas-faint" style={{ fontSize: 13, flexShrink: 0 }}>
                {ql ? `${matches.length}/${routes.length}` : routes.length}
              </span>
            </div>
            {ql ? (
              matches.length === 0 ? (
                <p className="atlas-faint" style={{ padding: '8px 0' }}>No routes match “{query}”.</p>
              ) : (
                <ul className="atlas-tree atlas-tree--flat">
                  {matches.map((r) => (
                    <li key={r.id}>
                      <button
                        className="atlas-tree-node"
                        style={r.id === selected?.id ? { background: 'var(--surface-2)', borderColor: 'var(--hairline)' } : undefined}
                        onClick={() => setSelected(r)}
                      >
                        <TypeBadge type="route" />
                        <span style={{ color: '#e6a3ff' }}>{r.routePath || r.name}</span>
                        {r.componentName && (
                          <>
                            <span className="atlas-faint"> → </span>
                            <span className="mono" style={{ color: '#7fc4ff' }}>{r.componentName}</span>
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ul className="atlas-tree">
                {(() => {
                  const seen = new Set<string>();
                  return roots.map((r) => (
                    <RouteNode
                      key={r.id}
                      route={r}
                      byPath={byPath}
                      seen={seen}
                      onSelect={setSelected}
                      selectedId={selected?.id || null}
                    />
                  ));
                })()}
              </ul>
            )}
          </div>
          <div className="atlas-card" style={{ overflow: 'hidden', position: 'sticky', top: 80 }}>
            {selected ? (
              <Detail asset={selected} />
            ) : (
              <div className="atlas-detail-empty" style={{ minHeight: 280 }}>
                <p>Select a route to view its details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
