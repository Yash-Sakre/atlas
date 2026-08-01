import { useEffect, useMemo, useRef, useState } from 'react';
import { FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset } from '../types';
import { SearchField, SourceBadge, TypeBadge, useFuzzy } from '../ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Detail from './Detail';
import { cn } from '@/lib/utils';

type Usage = 'all' | 'used' | 'unused';

const DETAIL_KEYS = ['name', 'path', 'tags', 'signature', 'description.purpose'];

const USAGE_TABS: Array<[Usage, string]> = [
  ['all', 'All'],
  ['used', 'Used'],
  ['unused', 'Unused'],
];

export default function AssetList({
  collection,
  title,
  subtitle,
  placeholder,
}: {
  collection: 'components' | 'hooks' | 'utils' | 'contexts';
  title: string;
  subtitle: string;
  placeholder: string;
}) {
  const data = useData();
  const items = (data[collection] as Asset[]) || [];

  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Usage>('all');
  const [docsOnly, setDocsOnly] = useState(false);
  const [tag, setTag] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const filter = useFuzzy(items, DETAIL_KEYS);

  // Tags that actually appear in this collection, by frequency.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((a) => (a.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [items]);

  const list = useMemo(() => {
    let base = filter(query);
    if (usage === 'used') base = base.filter((a) => (a.usageCount || 0) > 0);
    else if (usage === 'unused') base = base.filter((a) => !(a.usageCount || 0));
    if (docsOnly) base = base.filter((a) => Boolean(a.description?.purpose));
    if (tag) base = base.filter((a) => (a.tags || []).includes(tag));
    base.sort((a, b) => a.name.localeCompare(b.name));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, usage, docsOnly, tag, items]);

  const hasFilters = Boolean(query || usage !== 'all' || docsOnly || tag);
  function clearFilters() {
    setQuery('');
    setUsage('all');
    setDocsOnly(false);
    setTag('');
  }

  // Auto-select the first item (wide screens) so the detail pane isn't empty.
  useEffect(() => {
    if (selectedId && items.some((i) => i.id === selectedId)) return;
    const isNarrow = window.matchMedia('(max-width: 900px)').matches;
    if (!isNarrow && list.length) setSelectedId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  const selected = items.find((i) => i.id === selectedId) || null;

  function select(id: string) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 900px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const visibleTags = showAllTags ? tags : tags.slice(0, 8);

  return (
    <>
      <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
            {title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium tabular-nums text-ink-muted">
            {items.length} total
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] items-stretch gap-5.5 max-[900px]:grid-cols-1">
        <aside className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-col gap-2.5">
            <SearchField value={query} onChange={setQuery} placeholder={placeholder} />

            <div className="flex items-center justify-between gap-2.5">
              <Tabs value={usage} onValueChange={(v) => setUsage(v as Usage)}>
                <TabsList>
                  {USAGE_TABS.map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-ink-faint">
                <b className="font-semibold text-ink-muted">{list.length}</b> / {items.length}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2.5">
              <ToggleGroup
                type="multiple"
                value={docsOnly ? ['documented'] : []}
                onValueChange={(v) => setDocsOnly(v.includes('documented'))}
              >
              </ToggleGroup>
              {hasFilters && (
                <button
                  type="button"
                  className="cursor-pointer border-none bg-none p-0 text-xs text-accent hover:underline"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              )}
            </div>

            {tags.length > 0 && (
              <ToggleGroup
                type="single"
                value={tag}
                onValueChange={setTag}
                className="flex flex-wrap gap-1.5"
              >
                {visibleTags.map((t) => (
                  <ToggleGroupItem key={t} value={t}>
                    {t}
                  </ToggleGroupItem>
                ))}
                {tags.length > 8 && (
                  <button
                    type="button"
                    className="cursor-pointer self-center border-none bg-none p-0 pl-0.5 text-xs text-accent hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAllTags((v) => !v);
                    }}
                  >
                    {showAllTags ? 'Less' : `+${tags.length - 8} more`}
                  </button>
                )}
              </ToggleGroup>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 max-[900px]:max-h-105">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13.5px] text-ink-faint">
                <FiInbox size={26} strokeWidth={1.6} />
                <p>No {title.toLowerCase()} match your filters.</p>
              </div>
            ) : (
              list.map((a) => (
                <button
                  key={a.id}
                  className={cn(
                    'w-full cursor-pointer rounded-md bg-surface-1 px-3.25 py-2.75 text-left transition-[background-color,box-shadow] duration-120 hover:bg-surface-2',
                    a.id === selectedId &&
                      'bg-surface-2 shadow-[inset_2px_0_0_var(--color-accent)]',
                  )}
                  onClick={() => select(a.id)}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="min-w-0 truncate font-mono text-[13.5px] font-semibold tracking-normal text-ink">
                      {a.name}
                    </span>
                    <TypeBadge type={a.type} />
                  </div>
                  <span className="mt-0.75 block truncate font-mono text-[11px] tracking-normal text-ink-faint">
                    {a.path}
                  </span>
                  <div className="mt-2.25 flex items-center justify-between gap-2">
                    <span className="text-[11px] tabular-nums text-ink-faint">
                      used {a.usageCount || 0}×
                    </span>
                    <SourceBadge source={a.description?.source} />
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section
          ref={detailRef}
          className="h-full min-w-0 overflow-y-auto overscroll-contain rounded-lg bg-surface-1 shadow-card max-[900px]:h-auto max-[900px]:overflow-hidden"
        >
          {selected ? (
            <Detail asset={selected} />
          ) : (
            <div className="flex h-full min-h-85 flex-col items-center justify-center gap-3 p-12 text-center text-sm text-ink-faint [&>svg]:text-ink-faint [&>svg]:opacity-70">
              <FiInbox size={32} strokeWidth={1.5} />
              <p>Select an asset to view its details</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
