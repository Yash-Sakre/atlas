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
  eyebrow,
  subtitle,
  placeholder,
}: {
  collection: 'components' | 'hooks' | 'utils' | 'contexts';
  title: string;
  eyebrow: string;
  subtitle: string;
  placeholder: string;
}) {
  const data = useData();
  const items = (data[collection] as Asset[]) || [];

  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Usage>('all');
  const [docsOnly, setDocsOnly] = useState(false);
  const [tag, setTag] = useState('');
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

  // Auto-select the first item (wide screens) so the detail pane isn't empty.
  useEffect(() => {
    if (selectedId && items.some((i) => i.id === selectedId)) return;
    const isNarrow = window.matchMedia('(max-width: 880px)').matches;
    if (!isNarrow && list.length) setSelectedId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  const selected = items.find((i) => i.id === selectedId) || null;

  function select(id: string) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 880px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <>
      <div className="mb-10">
        <p className="atlas-eyebrow">{eyebrow}</p>
        <h1 className="atlas-page-title">{title}</h1>
        <p className="atlas-lead">{subtitle}</p>
      </div>

      <div className="atlas-split">
        <aside className="atlas-side">
          <div className="atlas-side-tools">
            <SearchField value={query} onChange={setQuery} placeholder={placeholder} />

            <Tabs value={usage} onValueChange={(v) => setUsage(v as Usage)}>
              <TabsList className="flex w-full">
                {USAGE_TABS.map(([key, label]) => (
                  <TabsTrigger key={key} value={key} className="flex-1">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center justify-between gap-2">
              <ToggleGroup
                type="multiple"
                value={docsOnly ? ['documented'] : []}
                onValueChange={(v) => setDocsOnly(v.includes('documented'))}
              >
                <ToggleGroupItem value="documented" title="Only assets with a description">
                  Documented
                </ToggleGroupItem>
              </ToggleGroup>
              <span className="atlas-faint" style={{ fontSize: 13 }}>
                {list.length} / {items.length}
              </span>
            </div>

            {tags.length > 0 && (
              <ToggleGroup
                type="single"
                value={tag}
                onValueChange={setTag}
                className="flex flex-wrap gap-1.5"
              >
                {tags.slice(0, 12).map((t) => (
                  <ToggleGroupItem key={t} value={t}>
                    {t}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>

          <div className="atlas-side-list">
            {list.length === 0 ? (
              <p className="atlas-faint" style={{ textAlign: 'center', padding: '32px 0' }}>
                No {title.toLowerCase()} found.
              </p>
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
                    <span className="atlas-faint" style={{ fontSize: 11 }}>
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
              <FiInbox size={34} strokeWidth={1.5} />
              <p>Select an asset to view its details</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
