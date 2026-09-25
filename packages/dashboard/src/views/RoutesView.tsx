import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AppWindow,
  ArrowBendDownRight,
  CaretRight,
  CursorClick,
  File,
  FolderSimple,
  Layout,
  MagnifyingGlass,
  Plug,
  Signpost,
  StackSimple,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useData } from '../data';
import type { Asset } from '../types';
import { FilterCount, SearchField } from '../ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Detail from './Detail';

const NARROW = '(max-width: 900px)';
const isNarrow = () => window.matchMedia(NARROW).matches;
const SELECTION_ID = 'route-sel';
/** Horizontal step per tree level, px. */
const INDENT = 14;

/* ───────────────────────────── Route model ───────────────────────────── */

type Kind = 'layout' | 'page' | 'screen' | 'api' | 'redirect';

const KIND: Record<Kind, { label: string; icon: PhosphorIcon }> = {
  layout: { label: 'layout', icon: Layout },
  page: { label: 'page', icon: File },
  screen: { label: 'route', icon: AppWindow },
  api: { label: 'api', icon: Plug },
  redirect: { label: 'redirect', icon: ArrowBendDownRight },
};

/** What a route *is*, for its icon — derived from the analyzer's segment kind. */
function kindOf(r: Asset): Kind {
  if (r.segmentKind === 'layout') return 'layout';
  if (r.segmentKind === 'page') return 'page';
  if (r.componentName === 'Navigate' || r.componentName === 'Redirect') return 'redirect';
  // A file-router `route` with no component is a request handler (route.ts).
  if (r.segmentKind === 'route' && !r.componentName && r.router !== 'react-router') return 'api';
  return 'screen';
}

/** Layouts sort first at a path, then pages/screens, then handlers. */
const KIND_ORDER: Record<Kind, number> = { layout: 0, page: 1, screen: 1, api: 2, redirect: 3 };

/** "apps/site/app/(home)/page.tsx" → "(home)/page.tsx". */
const fileTail = (p: string) => p.split('/').slice(-2).join('/');

/** A URL segment is dynamic if it binds a param or globs: `:id`, `[slug]`, `*`, `*?`. */
const isDynamic = (seg: string) => /^[:[]|\*/.test(seg);

/** A trie node: one URL segment, the routes declared exactly at it, and deeper segments. */
interface SegNode {
  key: string;
  /** Display label — one segment, or a compacted `a/b` chain of empty ones. */
  label: string;
  fullPath: string;
  routes: Asset[];
  children: SegNode[];
}

interface Group {
  key: string;
  workspace: string | null;
  router?: string;
  count: number;
  root: SegNode;
}

/**
 * Absolute URL for a route. Paths without a leading slash are relative
 * (react-router children, "(index)"): they resolve against the parent that
 * lists them in `childRoutes`, else against "/".
 */
function makeResolver(routes: Asset[]) {
  const parentByChild = new Map<string, Asset>();
  for (const r of routes) for (const c of r.childRoutes || []) if (!parentByChild.has(c)) parentByChild.set(c, r);
  const memo = new Map<string, string>();
  const resolve = (r: Asset, depth = 0): string => {
    const hit = memo.get(r.id);
    if (hit) return hit;
    const raw = (r.routePath || r.name || '').trim();
    let out: string;
    if (raw.startsWith('/')) out = raw;
    else {
      const parent = raw && depth < 16 ? parentByChild.get(raw) : undefined;
      const base = parent && parent !== r ? resolve(parent, depth + 1) : '/';
      const rel = raw === '(index)' ? '' : raw;
      out = `${base.replace(/\/+$/, '')}/${rel}`.replace(/\/+$/, '') || '/';
    }
    memo.set(r.id, out);
    return out;
  };
  return resolve;
}

/** Build one trie per workspace, then compact chains of route-less segments. */
function buildGroups(routes: Asset[], resolve: (r: Asset) => string): Group[] {
  const byWs = new Map<string, Asset[]>();
  for (const r of routes) {
    const ws = r.workspace || '';
    byWs.set(ws, [...(byWs.get(ws) || []), r]);
  }

  const groups: Group[] = [];
  for (const [ws, list] of byWs) {
    const root: SegNode = { key: `${ws}:/`, label: '/', fullPath: '/', routes: [], children: [] };
    for (const r of list) {
      const segs = resolve(r).split('/').filter(Boolean);
      let node = root;
      let path = '';
      for (const seg of segs) {
        path += `/${seg}`;
        let next = node.children.find((c) => c.fullPath === path);
        if (!next) {
          next = { key: `${ws}:${path}`, label: seg, fullPath: path, routes: [], children: [] };
          node.children.push(next);
        }
        node = next;
      }
      node.routes.push(r);
    }

    const tidy = (n: SegNode) => {
      n.routes.sort((a, b) => KIND_ORDER[kindOf(a)] - KIND_ORDER[kindOf(b)]);
      // Static segments before dynamic ones, then alphabetical — how URLs match.
      n.children.sort(
        (a, b) => Number(isDynamic(a.label)) - Number(isDynamic(b.label)) || a.label.localeCompare(b.label),
      );
      n.children = n.children.map((c) => {
        // `/llms.mdx` → `/docs` → `*?` with nothing declared in between reads
        // better as one `llms.mdx/docs` folder.
        while (c.routes.length === 0 && c.children.length === 1) {
          const only = c.children[0];
          c = { ...only, label: `${c.label}/${only.label}` };
        }
        tidy(c);
        return c;
      });
    };
    tidy(root);

    groups.push({
      key: ws || '_',
      workspace: ws || null,
      router: list.find((r) => r.router)?.router,
      count: list.length,
      root,
    });
  }
  return groups.sort((a, b) => b.count - a.count);
}

/* ─────────────────────────────── Rows ─────────────────────────────── */

interface RowCtx {
  selectedId: string | null;
  /** The one row in the tab order (roving tabindex). */
  tabbableId: string | null;
  collapsed: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (key: string) => void;
  registerRow: (id: string, el: HTMLButtonElement | null) => void;
}

/** A path label with dynamic segments set apart as quiet pills. */
function PathLabel({ label, className }: { label: string; className?: string }) {
  const parts = label === '/' ? ['/'] : label.split('/');
  return (
    <span className={cn('flex min-w-0 items-center gap-0.5 truncate font-mono text-[12.5px]', className)}>
      {parts.map((p, i) => (
        <span key={i} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && <span className="text-ink-faint">/</span>}
          {isDynamic(p) ? (
            <span className="rounded-xs bg-accent-soft px-1 text-accent">{p}</span>
          ) : (
            <span className="truncate">{p}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Indent guides: one hairline per ancestor level, like an editor's file tree. */
function Guides({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-px bg-hairline-soft"
          style={{ left: 17 + i * INDENT }}
        />
      ))}
    </>
  );
}

function Chevron({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={open}
      onClick={onClick}
      className="relative z-1 grid h-6 w-5 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-faint transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
    >
      <CaretRight
        size={10}
        weight="bold"
        className={cn('transition-transform duration-200 ease-out-quint', open && 'rotate-90')}
      />
    </button>
  );
}

/** A selectable route row. The chevron (if any) is a sibling button — never nested. */
function RouteRow({
  route,
  label,
  depth,
  ctx,
  toggle,
  showPath,
}: {
  route: Asset;
  /** The segment to show; `null` for a second declaration at the same path. */
  label: string | null;
  depth: number;
  ctx: RowCtx;
  toggle?: { open: boolean; onClick: () => void };
  /** Search results: show the full resolved path instead of a segment. */
  showPath?: string;
}) {
  const active = route.id === ctx.selectedId;
  const kind = kindOf(route);
  const KindIcon = KIND[kind].icon;
  return (
    <div className="relative flex h-8 min-w-0 items-center" style={{ paddingLeft: 6 + depth * INDENT }}>
      <Guides depth={depth} />
      {active && (
        <motion.span
          layoutId={SELECTION_ID}
          aria-hidden="true"
          transition={{ type: 'spring', bounce: 0.12, duration: 0.3 }}
          className="absolute inset-y-0 right-0 rounded-md bg-surface-2 shadow-[inset_2px_0_0_var(--color-accent)]"
          style={{ left: 2 + depth * INDENT }}
        />
      )}
      {toggle ? (
        <Chevron open={toggle.open} label={label || route.name} onClick={toggle.onClick} />
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        ref={(el) => ctx.registerRow(route.id, el)}
        aria-current={active ? 'true' : undefined}
        tabIndex={route.id === ctx.tabbableId ? 0 : -1}
        onClick={() => ctx.onSelect(route.id)}
        title={showPath ?? route.path}
        className={cn(
          'group relative z-1 flex h-full min-w-0 flex-1 cursor-pointer scroll-my-1.5 items-center gap-2 rounded-md pr-2 pl-1 text-left outline-none',
          'focus-visible:ring-[3px] focus-visible:ring-accent-ring',
          !active && 'transition-colors duration-150 hover:bg-surface-2/60',
        )}
      >
        <KindIcon
          size={15}
          className={cn('shrink-0 transition-colors', active ? 'text-accent' : 'text-ink-faint')}
          aria-hidden="true"
        />
        {label === null && !showPath ? (
          // A second declaration at the same path (e.g. a route-group layout):
          // name it by its file, since the segment is already on the row above.
          <span className="min-w-0 truncate font-mono text-[12px] text-ink-faint">{fileTail(route.path)}</span>
        ) : (
          <PathLabel
            label={showPath ?? label ?? '/'}
            className={active ? 'text-ink' : 'text-ink-muted group-hover:text-ink'}
          />
        )}
        {kind === 'redirect' && (
          <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-ink-faint">redirect</span>
        )}
        {route.componentName && kind !== 'redirect' && (
          <span className="ml-auto min-w-0 shrink truncate pl-2 font-mono text-[11.5px] text-ink-faint">
            {route.componentName}
          </span>
        )}
      </button>
    </div>
  );
}

/** A path segment nobody declared (e.g. `/api` above `/api/search`) — structure only. */
function FolderRow({ node, depth, open, onToggle }: { node: SegNode; depth: number; open: boolean; onToggle: () => void }) {
  return (
    <div className="relative flex h-8 min-w-0 items-center" style={{ paddingLeft: 6 + depth * INDENT }}>
      <Guides depth={depth} />
      <Chevron open={open} label={node.fullPath} onClick={onToggle} />
      <span className="flex min-w-0 items-center gap-2 pl-1 text-ink-faint">
        <FolderSimple size={15} className="shrink-0" aria-hidden="true" />
        <PathLabel label={node.label} />
      </span>
    </div>
  );
}

/** Pure recursive renderer — no side effects, so it's StrictMode-safe. */
function SegTree({ node, depth, ctx }: { node: SegNode; depth: number; ctx: RowCtx }) {
  const hasKids = node.children.length > 0;
  const open = hasKids && !ctx.collapsed.has(node.key);
  const toggle = hasKids ? { open, onClick: () => ctx.onToggle(node.key) } : undefined;
  return (
    <li>
      {node.routes.length === 0 ? (
        <FolderRow node={node} depth={depth} open={open} onToggle={() => ctx.onToggle(node.key)} />
      ) : (
        node.routes.map((r, i) => (
          <RouteRow
            key={r.id}
            route={r}
            label={i === 0 ? node.label : null}
            depth={i === 0 ? depth : depth + 1}
            ctx={ctx}
            toggle={i === 0 ? toggle : undefined}
          />
        ))
      )}
      {open && (
        <ul className="m-0 list-none p-0">
          {node.children.map((c) => (
            <SegTree key={c.key} node={c} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

function GroupHeader({
  group,
  open,
  onToggle,
  children,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      aria-expanded={open}
      className="sticky top-0 z-2 flex h-9 w-full cursor-pointer items-center gap-2 rounded-md bg-surface-1 px-1.5 text-left transition-colors hover:bg-surface-2/60"
    >
      <CaretRight
        size={10}
        weight="bold"
        className={cn('ml-1 shrink-0 text-ink-faint transition-transform duration-200 ease-out-quint', open && 'rotate-90')}
      />
      <StackSimple size={15} className="shrink-0 text-ink-muted" />
      <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
        {group.workspace ?? 'Routes'}
      </span>
      {group.router && <span className="shrink-0 text-[11px] text-ink-faint">{group.router}</span>}
      <span className="ml-auto shrink-0 text-[11px] text-ink-faint tabular-nums">{group.count}</span>
      {children}
    </button>
  );
}

/* ─────────────────────────────── View ─────────────────────────────── */

export default function RoutesView() {
  const data = useData();
  const routes = useMemo(() => data.routes || [], [data]);

  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const detailRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollTarget = useRef<string | null>(null);

  const { groups, fullPath, ancestorsOf, parentRouteOf, nodeOf } = useMemo(() => {
    const resolve = makeResolver(routes);
    const groups = buildGroups(routes, resolve);
    // Index the trie: each route's node, its ancestor keys (for deep-link
    // expansion) and its nearest ancestor route (for ArrowLeft).
    const ancestorsOf = new Map<string, string[]>();
    const parentRouteOf = new Map<string, string>();
    const nodeOf = new Map<string, SegNode>();
    const walk = (n: SegNode, trail: string[], parentRoute?: string) => {
      n.routes.forEach((r, i) => {
        nodeOf.set(r.id, n);
        ancestorsOf.set(r.id, trail);
        const p = i === 0 ? parentRoute : n.routes[0].id;
        if (p) parentRouteOf.set(r.id, p);
      });
      const next = n.routes[0]?.id ?? parentRoute;
      n.children.forEach((c) => walk(c, [...trail, n.key], next));
    };
    groups.forEach((g) => walk(g.root, [`group:${g.key}`]));
    const fullPath = new Map(routes.map((r) => [r.id, resolve(r)]));
    return { groups, fullPath, ancestorsOf, parentRouteOf, nodeOf };
  }, [routes]);

  const multi = groups.length > 1;

  const ql = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!ql) return [];
    return routes
      .filter((r) =>
        [fullPath.get(r.id), r.componentName, r.workspace].some((v) => v?.toLowerCase().includes(ql)),
      )
      .sort((a, b) => (fullPath.get(a.id) || '').localeCompare(fullPath.get(b.id) || ''));
  }, [ql, routes, fullPath]);

  /** Route rows currently on screen, in DOM order — what ArrowUp/Down walks. */
  const visibleIds = useMemo(() => {
    if (ql) return matches.map((r) => r.id);
    const out: string[] = [];
    const walk = (n: SegNode) => {
      n.routes.forEach((r) => out.push(r.id));
      if (!collapsed.has(n.key)) n.children.forEach(walk);
    };
    groups.forEach((g) => {
      if (!collapsed.has(`group:${g.key}`)) walk(g.root);
    });
    return out;
  }, [ql, matches, groups, collapsed]);

  // Deep link (`?focus=<id>`): select it, clear a search that hides it, expand its ancestors.
  useEffect(() => {
    if (!focus) return;
    const target = routes.find((r) => r.id === focus);
    if (!target) return;
    if (ql && !matches.some((r) => r.id === focus)) setQuery('');
    setCollapsed((prev) => {
      const trail = ancestorsOf.get(focus) || [];
      if (!trail.some((k) => prev.has(k))) return prev;
      const next = new Set(prev);
      trail.forEach((k) => next.delete(k));
      return next;
    });
    setSelectedId(focus);
    scrollTarget.current = focus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, routes, ancestorsOf]);

  // Otherwise auto-select the first route on wide screens so the detail pane isn't empty.
  useEffect(() => {
    if (focus && routes.some((r) => r.id === focus)) return;
    if (!selectedId && !isNarrow() && visibleIds.length) setSelectedId(visibleIds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll a pending row into view once it has rendered.
  useEffect(() => {
    const id = scrollTarget.current;
    if (!id) return;
    const el = rowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      scrollTarget.current = null;
    }
  });

  const selected = routes.find((r) => r.id === selectedId) || null;

  function select(id: string, opts: { fromKeyboard?: boolean } = {}) {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set('focus', id);
    setParams(next, { replace: true });
    if (opts.fromKeyboard) {
      const el = rowRefs.current.get(id);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest' });
    } else if (isNarrow()) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggle(key: string, open?: boolean) {
    setCollapsed((prev) => {
      const isOpen = !prev.has(key);
      if (open === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function onTreeKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!visibleIds.length) return;
    const idx = selectedId ? visibleIds.indexOf(selectedId) : -1;
    let next = -1;
    switch (e.key) {
      case 'ArrowDown':
        next = idx < 0 ? 0 : Math.min(visibleIds.length - 1, idx + 1);
        break;
      case 'ArrowUp':
        next = idx < 0 ? 0 : Math.max(0, idx - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = visibleIds.length - 1;
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        // Tree convention: right expands, left collapses (or jumps to the parent).
        if (ql || !selectedId) return;
        e.preventDefault();
        const node = nodeOf.get(selectedId);
        const ownsNode = node?.routes[0]?.id === selectedId;
        const hasKids = ownsNode && Boolean(node?.children.length);
        if (e.key === 'ArrowRight') {
          if (hasKids && node) toggle(node.key, true);
        } else if (hasKids && node && !collapsed.has(node.key)) {
          toggle(node.key, false);
        } else {
          const parent = parentRouteOf.get(selectedId);
          if (parent) select(parent, { fromKeyboard: true });
        }
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    if (next !== idx) select(visibleIds[next], { fromKeyboard: true });
  }

  const ctx: RowCtx = {
    selectedId,
    tabbableId: selectedId && visibleIds.includes(selectedId) ? selectedId : (visibleIds[0] ?? null),
    collapsed,
    onSelect: (id) => select(id),
    onToggle: (key) => toggle(key),
    registerRow: (id, el) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    },
  };

  const allOpen = collapsed.size === 0;

  return (
    <>
      <PageHeader
        title="Routes"
        description="Every route the analyzer found, nested by URL and grouped by app"
        actions={<Badge variant="outline">{routes.length.toLocaleString()} routes</Badge>}
      />

      {routes.length === 0 ? (
        <Card>
          <EmptyState icon={<Signpost size={20} />} title="No routes found">
            The analyzer didn't find a router configuration in this project.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 max-[900px]:grid-cols-1 max-[900px]:grid-rows-none">
          {/* ── Tree ── */}
          <Card className="min-h-0 overflow-hidden">
            <div className="flex shrink-0 flex-col gap-2 border-b border-hairline-soft p-3">
              <SearchField value={query} onChange={setQuery} placeholder="Search paths or components…" />
              <div className="flex items-center justify-between gap-2">
                <Legend />
                {ql ? (
                  <FilterCount shown={matches.length} total={routes.length} />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed(
                        allOpen
                          ? new Set(
                              groups.flatMap((g) => {
                                const keys: string[] = [];
                                const walk = (n: SegNode) => {
                                  if (n.children.length) keys.push(n.key);
                                  n.children.forEach(walk);
                                };
                                walk(g.root);
                                return keys;
                              }),
                            )
                          : new Set(),
                      )
                    }
                    className="shrink-0 cursor-pointer rounded-sm text-[11.5px] text-ink-faint transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none"
                  >
                    {allOpen ? 'Collapse all' : 'Expand all'}
                  </button>
                )}
              </div>
            </div>

            <motion.div
              layoutScroll
              onKeyDown={onTreeKeyDown}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 max-[900px]:max-h-105"
            >
              {ql ? (
                matches.length === 0 ? (
                  <EmptyState icon={<MagnifyingGlass size={20} />} title="No matching routes">
                    Nothing matches “{query}”.
                  </EmptyState>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {matches.map((r) => (
                      <li key={r.id}>
                        <RouteRow route={r} label="" showPath={fullPath.get(r.id)} depth={0} ctx={ctx} />
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="flex flex-col gap-2">
                  {groups.map((g) => {
                    const gKey = `group:${g.key}`;
                    const open = !collapsed.has(gKey);
                    return (
                      <section key={g.key}>
                        {multi && <GroupHeader group={g} open={open} onToggle={() => toggle(gKey)} />}
                        {open && (
                          <ul className="m-0 list-none p-0">
                            <SegTree node={g.root} depth={0} ctx={ctx} />
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </Card>

          {/* ── Detail ── */}
          <div ref={detailRef} className="flex min-h-0 max-[900px]:scroll-mt-4">
            <Card className="min-h-0 flex-1 overflow-hidden max-[900px]:min-h-85">
              {selected ? (
                <Detail asset={selected} />
              ) : (
                <EmptyState icon={<CursorClick size={20} />} title="No route selected" className="h-full">
                  Pick a route from the tree to see its component, API and usages.
                </EmptyState>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Icon key for the row glyphs — each kind named once, so icons never carry meaning alone. */
function Legend() {
  const kinds: Kind[] = ['layout', 'page', 'screen', 'api'];
  return (
    <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
      {kinds.map((k) => {
        const I = KIND[k].icon;
        return (
          <Tooltip key={k} content={k === 'screen' ? 'Route rendering a component' : k === 'api' ? 'Request handler (no UI)' : `${KIND[k].label} segment`}>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-faint">
              <I size={13} aria-hidden="true" />
              {KIND[k].label}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
