import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  CaretRight,
  CursorClick,
  MagnifyingGlass,
  Signpost,
} from "@phosphor-icons/react";
import { useData } from "../data";
import type { Asset } from "../types";
import { FilterCount, SearchField, Tag } from "../ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import Detail from "./Detail";

const NARROW = "(max-width: 900px)";
const isNarrow = () => window.matchMedia(NARROW).matches;
const SELECTION_ID = "route-sel";

/** A route plus its already-resolved children — a pure tree, built once in useMemo. */
interface RouteTreeNode {
  route: Asset;
  children: RouteTreeNode[];
}

/**
 * Nested branch: the `<li>` draws an elbow connector (vertical ::before running
 * down the rail, horizontal ::after into the row) in hairline-soft. The last
 * child stops its rail at the elbow.
 */
const BRANCH_CLASS =
  "relative pl-3 before:absolute before:top-0 before:bottom-0 before:left-0 before:border-l before:border-hairline-soft before:content-[''] last:before:bottom-auto last:before:h-4 after:absolute after:top-4 after:left-0 after:w-2.5 after:border-t after:border-hairline-soft after:content-['']";

interface RowCtx {
  selectedId: string | null;
  /** The one row in the tab order (roving tabindex). */
  tabbableId: string | null;
  collapsed: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  registerRow: (id: string, el: HTMLButtonElement | null) => void;
}

function RouteLabel({ route }: { route: Asset }) {
  return (
    <>
      <span className="min-w-0 shrink truncate font-mono text-[12.5px] text-ink">
        {route.routePath || route.name}
      </span>
      {route.segmentKind && <Tag>{route.segmentKind}</Tag>}
      {route.componentName && (
        <span className="flex min-w-0 shrink-2 items-center gap-1 text-ink-faint">
          <ArrowRight
            size={11}
            weight="bold"
            className="shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate font-mono text-[12px]">
            {route.componentName}
          </span>
        </span>
      )}
    </>
  );
}

/** One selectable row. The chevron (if any) is a sibling button — never nested. */
function RouteRow({
  route,
  ctx,
  expandable,
  expanded,
}: {
  route: Asset;
  ctx: RowCtx;
  expandable?: boolean;
  expanded?: boolean;
}) {
  const active = route.id === ctx.selectedId;
  return (
    <div className="relative flex h-8 min-w-0 items-center rounded-md">
      {active && (
        <motion.span
          layoutId={SELECTION_ID}
          aria-hidden="true"
          transition={{ type: "spring", bounce: 0.12, duration: 0.3 }}
          className="absolute inset-0 rounded-md bg-surface-2"
        >
          <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />
        </motion.span>
      )}
      {expandable ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${route.routePath || route.name}`}
          aria-expanded={expanded}
          onClick={() => ctx.onToggle(route.id)}
          className="relative z-1 ml-1 grid h-6 w-5 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-faint transition-colors duration-150 hover:bg-surface-3 hover:text-ink focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none"
        >
          <CaretRight
            size={11}
            weight="bold"
            className={cn(
              "transition-transform duration-200 ease-out-quint",
              expanded && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span className="ml-1 w-5 shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        ref={(el) => ctx.registerRow(route.id, el)}
        aria-current={active ? "true" : undefined}
        tabIndex={route.id === ctx.tabbableId ? 0 : -1}
        onClick={() => ctx.onSelect(route.id)}
        className={cn(
          "relative z-1 flex h-full min-w-0 flex-1 cursor-pointer scroll-my-1.5 items-center gap-2 rounded-md pr-2.5 pl-1.5 text-left outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-accent-ring",
          !active && "transition-colors duration-150 hover:bg-surface-2/60",
        )}
      >
        <RouteLabel route={route} />
      </button>
    </div>
  );
}

/** Pure recursive renderer — no side effects, so it's StrictMode-safe. */
function RouteTree({
  nodes,
  ctx,
  nested,
}: {
  nodes: RouteTreeNode[];
  ctx: RowCtx;
  nested?: boolean;
}) {
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col gap-px p-0",
        nested && "mt-px ml-3.5",
      )}
    >
      {nodes.map((n) => {
        const hasKids = n.children.length > 0;
        const expanded = hasKids && !ctx.collapsed.has(n.route.id);
        return (
          <li key={n.route.id} className={nested ? BRANCH_CLASS : undefined}>
            <RouteRow
              route={n.route}
              ctx={ctx}
              expandable={hasKids}
              expanded={expanded}
            />
            {expanded && <RouteTree nodes={n.children} ctx={ctx} nested />}
          </li>
        );
      })}
    </ul>
  );
}

export default function RoutesView() {
  const data = useData();
  const routes = useMemo(() => data.routes || [], [data]);

  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const detailRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollTarget = useRef<string | null>(null);

  const { tree, parentOf } = useMemo(() => {
    const byPathMap: Record<string, Asset> = {};
    routes.forEach((r) => {
      if (r.routePath) byPathMap[r.routePath] = r;
    });
    const childPaths = new Set<string>();
    routes.forEach((r) =>
      (r.childRoutes || []).forEach((c) => childPaths.add(c)),
    );
    let rootList = routes.filter(
      (r) => !r.routePath || !childPaths.has(r.routePath),
    );
    if (!rootList.length) rootList = routes;

    // Resolve the nested structure once here (cycle-guarded), so rendering stays pure.
    const seen = new Set<string>();
    const parents = new Map<string, string>();
    const build = (r: Asset, parent?: string): RouteTreeNode | null => {
      if (seen.has(r.id)) return null;
      seen.add(r.id);
      if (parent) parents.set(r.id, parent);
      const children = (r.childRoutes || [])
        .map((c) => byPathMap[c])
        .filter(Boolean)
        .map((c) => build(c, r.id))
        .filter(Boolean) as RouteTreeNode[];
      return { route: r, children };
    };
    return {
      tree: rootList.map((r) => build(r)).filter(Boolean) as RouteTreeNode[],
      parentOf: parents,
    };
  }, [routes]);

  const ql = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!ql) return [];
    return routes.filter((r) => (r.routePath || "").toLowerCase().includes(ql));
  }, [ql, routes]);

  /** Rows currently on screen, in DOM order — what ArrowUp/Down walks. */
  const visibleIds = useMemo(() => {
    if (ql) return matches.map((r) => r.id);
    const out: string[] = [];
    const walk = (nodes: RouteTreeNode[]) =>
      nodes.forEach((n) => {
        out.push(n.route.id);
        if (!collapsed.has(n.route.id)) walk(n.children);
      });
    walk(tree);
    return out;
  }, [ql, matches, tree, collapsed]);

  // Deep link (`?focus=<id>`): select it, clear a search that hides it, expand its ancestors.
  useEffect(() => {
    if (!focus) return;
    const target = routes.find((r) => r.id === focus);
    if (!target) return;
    if (ql && !(target.routePath || "").toLowerCase().includes(ql))
      setQuery("");
    setCollapsed((prev) => {
      let next: Set<string> | null = null;
      for (let p = parentOf.get(focus); p; p = parentOf.get(p)) {
        if (prev.has(p)) {
          next ??= new Set(prev);
          next.delete(p);
        }
      }
      return next ?? prev;
    });
    setSelectedId(focus);
    scrollTarget.current = focus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, routes, parentOf]);

  // Otherwise auto-select the first route on wide screens so the detail pane isn't empty.
  useEffect(() => {
    if (focus && routes.some((r) => r.id === focus)) return;
    if (!selectedId && !isNarrow() && tree.length)
      setSelectedId(tree[0].route.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll a pending row into view once it has rendered.
  useEffect(() => {
    const id = scrollTarget.current;
    if (!id) return;
    const el = rowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      scrollTarget.current = null;
    }
  });

  const selected = routes.find((r) => r.id === selectedId) || null;

  function select(id: string, opts: { fromKeyboard?: boolean } = {}) {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set("focus", id);
    setParams(next, { replace: true });
    if (opts.fromKeyboard) {
      const el = rowRefs.current.get(id);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest" });
    } else if (isNarrow()) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggle(id: string, open?: boolean) {
    setCollapsed((prev) => {
      const isOpen = !prev.has(id);
      if (open === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onTreeKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!visibleIds.length) return;
    const idx = selectedId ? visibleIds.indexOf(selectedId) : -1;
    let next = -1;
    switch (e.key) {
      case "ArrowDown":
        next = idx < 0 ? 0 : Math.min(visibleIds.length - 1, idx + 1);
        break;
      case "ArrowUp":
        next = idx < 0 ? 0 : Math.max(0, idx - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = visibleIds.length - 1;
        break;
      case "ArrowRight":
      case "ArrowLeft": {
        // Tree convention: right expands, left collapses (or jumps to the parent).
        if (ql || !selectedId) return;
        e.preventDefault();
        const node = routes.find((r) => r.id === selectedId);
        const hasKids = Boolean(node?.childRoutes?.length);
        if (e.key === "ArrowRight") {
          if (hasKids) toggle(selectedId, true);
        } else if (hasKids && !collapsed.has(selectedId)) {
          toggle(selectedId, false);
        } else {
          const parent = parentOf.get(selectedId);
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
    tabbableId:
      selectedId && visibleIds.includes(selectedId)
        ? selectedId
        : (visibleIds[0] ?? null),
    collapsed,
    onSelect: (id) => select(id),
    onToggle: (id) => toggle(id),
    registerRow: (id, el) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    },
  };

  return (
    <>
      <PageHeader
        title="Routes"
        description="Route tree discovered from the router configuration"
        actions={
          <Badge variant="outline">
            {routes.length.toLocaleString()} routes
          </Badge>
        }
      />

      {routes.length === 0 ? (
        <Card>
          <EmptyState icon={<Signpost size={20} />} title="No routes found">
            The analyzer didn't find a router configuration in this project.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 max-[900px]:grid-cols-1 max-[900px]:grid-rows-none">
          {/* ── Tree ── */}
          <Card className="min-h-0 overflow-hidden">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-hairline-soft p-3">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search by route path…"
              />
              <FilterCount
                shown={ql ? matches.length : routes.length}
                total={routes.length}
              />
            </div>

            <motion.div
              layoutScroll
              onKeyDown={onTreeKeyDown}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 max-[900px]:max-h-105"
            >
              {ql ? (
                matches.length === 0 ? (
                  <EmptyState
                    icon={<MagnifyingGlass size={20} />}
                    title="No matching routes"
                  >
                    Nothing matches “{query}”.
                  </EmptyState>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-px p-0">
                    {matches.map((r) => (
                      <li key={r.id}>
                        <RouteRow route={r} ctx={ctx} />
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <RouteTree nodes={tree} ctx={ctx} />
              )}
            </motion.div>
          </Card>

          {/* ── Detail ── */}
          <div ref={detailRef} className="flex min-h-0 max-[900px]:scroll-mt-4">
            <Card className="min-h-0 flex-1 overflow-hidden max-[900px]:min-h-85">
              {selected ? (
                <Detail asset={selected} />
              ) : (
                <EmptyState
                  icon={<CursorClick size={20} />}
                  title="No route selected"
                  className="h-full"
                >
                  Pick a route from the tree to see its component, API and
                  usages.
                </EmptyState>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
