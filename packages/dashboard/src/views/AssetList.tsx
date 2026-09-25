import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CursorClick, FunnelSimple, Tray } from "@phosphor-icons/react";
import { useData } from "../data";
import type { Asset } from "../types";
import {
  FilterCount,
  SearchField,
  SourceBadge,
  TypeBadge,
  useSearch,
} from "../ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import Detail from "./Detail";

type Usage = "all" | "used" | "unused";

const SEARCH_KEYS = ["name"];
const TAG_LIMIT = 8;
const NARROW = "(max-width: 900px)";

const USAGE_TABS: Array<[Usage, string]> = [
  ["all", "All"],
  ["used", "Used"],
  ["unused", "Unused"],
];

const isNarrow = () => window.matchMedia(NARROW).matches;

export default function AssetList({
  collection,
  title,
  subtitle,
  placeholder,
}: {
  collection: "components" | "hooks" | "utils" | "contexts";
  title: string;
  subtitle: string;
  placeholder: string;
}) {
  const data = useData();
  const items = useMemo(
    () => (data[collection] as Asset[]) || [],
    [data, collection],
  );

  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");

  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<Usage>("all");
  const [docsOnly, setDocsOnly] = useState(false);
  const [tag, setTag] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  /** Row to bring into view once it has rendered (deep link / keyboard). */
  const scrollTarget = useRef<string | null>(null);

  const filter = useSearch(items, SEARCH_KEYS);

  // Tags that actually appear in this collection, by frequency.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((a) =>
      (a.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)),
    );
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [items]);

  const list = useMemo(() => {
    let base = filter(query);
    if (usage === "used") base = base.filter((a) => (a.usageCount || 0) > 0);
    else if (usage === "unused")
      base = base.filter((a) => !(a.usageCount || 0));
    if (docsOnly) base = base.filter((a) => Boolean(a.description?.purpose));
    if (tag) base = base.filter((a) => (a.tags || []).includes(tag));
    base.sort((a, b) => a.name.localeCompare(b.name));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, usage, docsOnly, tag, items]);

  const hasFilters = Boolean(query || usage !== "all" || docsOnly || tag);
  function clearFilters() {
    setQuery("");
    setUsage("all");
    setDocsOnly(false);
    setTag("");
  }

  // Deep link (`?focus=<id>`): select it, un-hide it, and bring it into view.
  useEffect(() => {
    if (!focus || !items.some((i) => i.id === focus)) return;
    if (!list.some((a) => a.id === focus)) clearFilters();
    setSelectedId(focus);
    scrollTarget.current = focus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, items]);

  // Otherwise auto-select the first item (wide screens) so the detail pane isn't empty.
  useEffect(() => {
    if (focus && items.some((i) => i.id === focus)) return;
    if (selectedId && items.some((i) => i.id === selectedId)) return;
    if (!isNarrow() && list.length) setSelectedId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  // Scroll a pending row into view after it renders (filters may have just cleared).
  useEffect(() => {
    const id = scrollTarget.current;
    if (!id) return;
    const el = rowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      scrollTarget.current = null;
    }
  });

  const selected = items.find((i) => i.id === selectedId) || null;

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

  function onListKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!list.length) return;
    const idx = list.findIndex((a) => a.id === selectedId);
    let next = -1;
    if (e.key === "ArrowDown")
      next = idx < 0 ? 0 : Math.min(list.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = idx < 0 ? 0 : Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else return;
    e.preventDefault();
    if (next !== idx) select(list[next].id, { fromKeyboard: true });
  }

  const tabbableId = list.some((a) => a.id === selectedId)
    ? selectedId
    : (list[0]?.id ?? null);
  const visibleTags = showAllTags ? tags : tags.slice(0, TAG_LIMIT);
  const noun = title.toLowerCase();

  return (
    <>
      <PageHeader
        title={title}
        description={subtitle}
        actions={
          <Badge variant="outline">{items.length.toLocaleString()} total</Badge>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 max-[900px]:grid-cols-1 max-[900px]:grid-rows-none">
        {/* ── Master list ── */}
        <Card className="min-h-0 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-hairline-soft p-3">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={placeholder}
            />

            <div className="flex items-center justify-between gap-2.5">
              <Tabs value={usage} onValueChange={(v) => setUsage(v as Usage)}>
                <TabsList aria-label="Usage filter">
                  {USAGE_TABS.map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <FilterCount shown={list.length} total={items.length} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleGroup
                type="multiple"
                aria-label="Documentation filter"
                value={docsOnly ? ["documented"] : []}
                onValueChange={(v) => setDocsOnly(v.includes("documented"))}
              >
                <ToggleGroupItem value="documented">Documented</ToggleGroupItem>
              </ToggleGroup>

              {tags.length > 0 && (
                <>
                  <span
                    className="mx-0.5 h-4 w-px bg-hairline"
                    aria-hidden="true"
                  />
                  <ToggleGroup
                    type="single"
                    aria-label="Tag filter"
                    value={tag}
                    onValueChange={setTag}
                    className="contents"
                  >
                    {visibleTags.map((t) => (
                      <ToggleGroupItem key={t} value={t}>
                        {t}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      aria-expanded={showAllTags}
                      onClick={() => setShowAllTags((v) => !v)}
                      className="inline-flex h-7 cursor-pointer items-center rounded-full px-2 text-[12px] font-medium text-ink-faint tabular-nums transition-colors duration-150 hover:text-ink focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none"
                    >
                      {showAllTags
                        ? "Show less"
                        : `+${tags.length - TAG_LIMIT} more`}
                    </button>
                  )}
                </>
              )}

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="ml-auto h-7 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <motion.div
            layoutScroll
            role="list"
            aria-label={title}
            onKeyDown={onListKeyDown}
            className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain p-1.5 max-[900px]:max-h-105"
          >
            {items.length === 0 ? (
              <EmptyState icon={<Tray size={20} />} title={`No ${noun} found`}>
                The analyzer didn't find any {noun} in this project.
              </EmptyState>
            ) : list.length === 0 ? (
              <EmptyState
                icon={<FunnelSimple size={20} />}
                title={`No ${noun} match your filters`}
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              list.map((a) => {
                const active = a.id === selectedId;
                return (
                  <div role="listitem" key={a.id}>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) rowRefs.current.set(a.id, el);
                        else rowRefs.current.delete(a.id);
                      }}
                      aria-current={active ? "true" : undefined}
                      tabIndex={a.id === tabbableId ? 0 : -1}
                      onClick={() => select(a.id)}
                      className={cn(
                        "relative block w-full cursor-pointer scroll-my-1.5 rounded-md px-3 py-2.5 text-left transition-colors duration-150 outline-none",
                        "focus-visible:ring-[3px] focus-visible:ring-accent-ring",
                        !active && "hover:bg-surface-2/60",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId={`asset-sel-${collection}`}
                          aria-hidden="true"
                          transition={{
                            type: "spring",
                            bounce: 0.12,
                            duration: 0.3,
                          }}
                          className="absolute inset-0 rounded-md bg-surface-2"
                        >
                          <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-accent" />
                        </motion.span>
                      )}
                      <span className="relative z-1 block">
                        <span className="flex items-center justify-between gap-2.5">
                          <span className="min-w-0 truncate font-mono text-[13px] font-medium text-ink">
                            {a.name}
                          </span>
                          <TypeBadge type={a.type} />
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-faint">
                          {a.path}
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11.5px] text-ink-faint tabular-nums">
                            used {a.usageCount || 0}×
                          </span>
                          <SourceBadge source={a.description?.source} />
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })
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
                title="Nothing selected"
                className="h-full"
              >
                Its description, API and usages show up here.
              </EmptyState>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
