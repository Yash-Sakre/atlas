import { useEffect, useMemo, useRef, useState } from 'react';
import { FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset } from '../types';
import { SearchField, SourceBadge, TypeBadge, useFuzzy } from '../ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Detail from './Detail';

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
      <div className="atlas-pagehead">
        <div className="atlas-pagehead-main">
          <h1 className="atlas-pagehead-title">{title}</h1>
          <p className="atlas-pagehead-sub">{subtitle}</p>
        </div>
        <div className="atlas-pagehead-side">
          <span className="atlas-pill tnum">{items.length} total</span>
        </div>
      </div>

      <div className="atlas-split">
        <aside className="atlas-side">
          <div className="atlas-filterbar">
            <SearchField value={query} onChange={setQuery} placeholder={placeholder} />

            <div className="atlas-filter-line">
              <Tabs value={usage} onValueChange={(v) => setUsage(v as Usage)}>
                <TabsList>
                  {USAGE_TABS.map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="atlas-filter-count">
                <b>{list.length}</b> / {items.length}
              </span>
            </div>

            <div className="atlas-filter-line">
              <ToggleGroup
                type="multiple"
                value={docsOnly ? ['documented'] : []}
                onValueChange={(v) => setDocsOnly(v.includes('documented'))}
              >
              </ToggleGroup>
              {hasFilters && (
                <button type="button" className="atlas-filter-clear" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>

            {tags.length > 0 && (
              <ToggleGroup
                type="single"
                value={tag}
                onValueChange={setTag}
                className="atlas-tagrow"
              >
                {visibleTags.map((t) => (
                  <ToggleGroupItem key={t} value={t}>
                    {t}
                  </ToggleGroupItem>
                ))}
                {tags.length > 8 && (
                  <button
                    type="button"
                    className="atlas-filter-clear"
                    style={{ alignSelf: 'center', paddingLeft: 2 }}
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

          <div className="atlas-side-list">
            {list.length === 0 ? (
              <div className="atlas-empty">
                <FiInbox size={26} strokeWidth={1.6} />
                <p>No {title.toLowerCase()} match your filters.</p>
              </div>
            ) : (
              list.map((a) => (
                <button
                  key={a.id}
                  className={`atlas-row${a.id === selectedId ? ' is-active' : ''}`}
                  onClick={() => select(a.id)}
                >
                  <div className="atlas-row-top">
                    <span className="mono atlas-row-name atlas-trunc">{a.name}</span>
                    <TypeBadge type={a.type} />
                  </div>
                  <span className="mono atlas-row-path atlas-trunc">{a.path}</span>
                  <div className="atlas-row-meta">
                    <span className="atlas-faint tnum" style={{ fontSize: 11 }}>
                      used {a.usageCount || 0}×
                    </span>
                    <SourceBadge source={a.description?.source} />
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section ref={detailRef} className="atlas-detail atlas-card">
          {selected ? (
            <Detail asset={selected} />
          ) : (
            <div className="atlas-detail-empty">
              <FiInbox size={32} strokeWidth={1.5} />
              <p>Select an asset to view its details</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
