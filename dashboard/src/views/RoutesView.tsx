import { useEffect, useMemo, useState } from 'react';
import { FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset } from '../types';
import { SearchField, TypeBadge } from '../ui';
import { cn } from '@/lib/utils';
import Detail from './Detail';

/** One tree row: the pill button, plus its connector lines when nested. */
const NODE_CLASS =
  'flex w-full max-w-full cursor-pointer items-center gap-2 rounded-md bg-surface-1 px-2.75 py-2 font-mono text-[12.5px] tracking-normal text-ink transition-[background-color,box-shadow] duration-130 hover:bg-surface-2';
const NODE_ACTIVE_CLASS = 'bg-surface-2 shadow-[inset_2px_0_0_var(--color-accent)]';

/** Elbow connectors drawn with ::before (vertical) / ::after (horizontal). */
const BRANCH_CLASS =
  "relative py-0.75 before:absolute before:top-0 before:bottom-0 before:left-[-0.65rem] before:border-l before:border-hairline-soft before:content-[''] last:before:bottom-1/2 after:absolute after:top-[0.9rem] after:left-[-0.65rem] after:w-[0.6rem] after:border-t after:border-hairline-soft after:content-['']";

function RouteLabel({ route }: { route: Asset }) {
  return (
    <>
      <TypeBadge type="route" />
      <span className="min-w-0 truncate text-t-route">{route.routePath || route.name}</span>
      {route.segmentKind && (
        <span className="font-mono text-[10px] tracking-normal text-ink-faint">
          [{route.segmentKind}]
        </span>
      )}
      {route.componentName && (
        <>
          <span className="text-ink-faint">→</span>
          <span className="min-w-0 truncate font-mono tracking-normal text-t-component">
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
    <ul className="m-0 list-none pl-[1.2rem]">
      {nodes.map((n) => (
        <li key={n.route.id} className={BRANCH_CLASS}>
          <button
            className={cn(NODE_CLASS, n.route.id === selectedId && NODE_ACTIVE_CLASS)}
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
      <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
            Routes
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            Route tree discovered from the router configuration
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium tabular-nums text-ink-muted">
            {routes.length} routes
          </span>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-1 p-12 text-center text-[13.5px] text-ink-faint shadow-card">
          <FiInbox size={28} strokeWidth={1.5} />
          <p>No routes found in this project.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] items-stretch gap-5.5 max-[900px]:grid-cols-1">
          <aside className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-col gap-2.5">
              <SearchField value={query} onChange={setQuery} placeholder="Filter routes…" />
              <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-ink-faint">
                <b className="font-semibold text-ink-muted">{ql ? matches.length : routes.length}</b>{' '}
                / {routes.length}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pt-1 pr-1 max-[900px]:max-h-105">
              {ql ? (
                matches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13.5px] text-ink-faint">
                    No routes match “{query}”.
                  </div>
                ) : (
                  <ul className="m-0 list-none pl-0">
                    {matches.map((r) => (
                      <li key={r.id} className="relative py-0.5">
                        <button
                          className={cn(NODE_CLASS, r.id === selected?.id && NODE_ACTIVE_CLASS)}
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

          <section className="h-full min-w-0 overflow-y-auto overscroll-contain rounded-lg bg-surface-1 shadow-card max-[900px]:h-auto max-[900px]:overflow-hidden">
            {selected ? (
              <Detail asset={selected} />
            ) : (
              <div className="flex h-full min-h-85 flex-col items-center justify-center gap-3 p-12 text-center text-sm text-ink-faint [&>svg]:text-ink-faint [&>svg]:opacity-70">
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
