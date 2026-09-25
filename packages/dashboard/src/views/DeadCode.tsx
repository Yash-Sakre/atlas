/**
 * Dead code: exports nothing imports, files whose every export is unused, and
 * likely duplicates. The KPI tiles double as the category switcher for the
 * card below; categories with nothing in them are never offered as tabs.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle, Copy, FileDashed, FunnelSimple } from '@phosphor-icons/react';
import { useData } from '../data';
import type { Asset, AssetType } from '../types';
import { EditorLink, FilterCount, SearchField, TABLE_CLASS, TypeBadge, useSearch } from '../ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const TYPE_ORDER: AssetType[] = ['component', 'hook', 'utility', 'context', 'store', 'provider'];

type TabKey = 'exports' | 'orphans' | 'duplicates';

/** The scrolling body of a tab — the only region that scrolls on this page. */
const BODY_CLASS = 'min-h-0 flex-1 overflow-auto overscroll-contain max-[900px]:overflow-visible';

/** The file path portion of an asset id like `src/foo.ts#Name`. */
function idPath(id: string): string {
  const hash = id.indexOf('#');
  return hash === -1 ? id : id.slice(0, hash);
}

const DESCRIPTION =
  'Exports nothing imports, orphaned files and likely duplicates. Click any path to open it in your editor.';

export default function DeadCode() {
  const data = useData();
  const root = data.meta.root;
  const dc = data.deadCode || {};

  const deadExports = useMemo(() => dc.deadExports || [], [dc.deadExports]);
  const orphanFiles = useMemo(() => dc.orphanFiles || [], [dc.orphanFiles]);
  const duplicates = useMemo(() => dc.duplicateCandidates || [], [dc.duplicateCandidates]);
  const total = deadExports.length + orphanFiles.length + duplicates.length;

  // id → asset, from every collection, so editor links land on the exact line
  // (dead-code items themselves only carry a path, not a line).
  const assetById = useMemo(() => {
    const m = new Map<string, Asset>();
    for (const a of [
      ...(data.components || []),
      ...(data.hooks || []),
      ...(data.utils || []),
      ...(data.contexts || []),
    ]) {
      m.set(a.id, a);
    }
    return m;
  }, [data]);

  const categories: Array<{ key: TabKey; label: string; count: number; hint: string }> = [
    { key: 'exports', label: 'Unused exports', count: deadExports.length, hint: 'never imported' },
    { key: 'orphans', label: 'Orphan files', count: orphanFiles.length, hint: 'every export unused' },
    { key: 'duplicates', label: 'Duplicates', count: duplicates.length, hint: 'candidate groups' },
  ];
  // Only categories that actually have items become tabs.
  const tabs = categories.filter((t) => t.count > 0);

  const [tab, setTab] = useState<TabKey>(() => tabs[0]?.key ?? 'exports');
  const active = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? 'exports');

  // ── Unused exports: search + type filter ──
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const searchExports = useSearch(deadExports, ['name']);
  const typesPresent = useMemo(
    () => TYPE_ORDER.filter((t) => deadExports.some((d) => d.type === t)),
    [deadExports],
  );
  const unusedList = useMemo(() => {
    let base = searchExports(query);
    if (typeFilter.length) base = base.filter((d) => typeFilter.includes(d.type));
    return base.sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, deadExports]);

  // ── Orphan files: search over the path ──
  const [orphanQuery, setOrphanQuery] = useState('');
  const orphanList = useMemo(() => {
    const q = orphanQuery.trim().toLowerCase();
    return q ? orphanFiles.filter((f) => f.toLowerCase().includes(q)) : orphanFiles;
  }, [orphanQuery, orphanFiles]);

  // ── Duplicates: search over the names in each group ──
  const [dupQuery, setDupQuery] = useState('');
  const dupIndexed = useMemo(
    () => duplicates.map((d) => ({ ...d, _names: d.names.join(' ') })),
    [duplicates],
  );
  const searchDupes = useSearch(dupIndexed, ['_names']);
  const dupList = useMemo(
    () => searchDupes(dupQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dupQuery, dupIndexed],
  );

  if (total === 0) {
    return (
      <>
        <PageHeader
          title="Dead code"
          description={DESCRIPTION}
          actions={
            <Badge variant="success">
              <CheckCircle size={11} weight="fill" />
              All clear
            </Badge>
          }
        />
        <Card>
          <EmptyState icon={<CheckCircle size={20} className="text-success" />} title="No dead code found">
            Every export is referenced, there are no orphan files, and no duplicate candidates.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dead code"
        description={DESCRIPTION}
        actions={
          <Badge variant="warn">
            <span className="tabular-nums">{total}</span> to review
          </Badge>
        }
      />

      {/* KPI tiles — each one selects its category in the card below. */}
      <div
        className="mb-4 grid shrink-0 grid-cols-3 gap-4 max-[760px]:grid-cols-1"
        role="group"
        aria-label="Dead code categories"
      >
        {categories.map((c) => {
          const selected = c.count > 0 && active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              disabled={c.count === 0}
              aria-pressed={selected}
              onClick={() => setTab(c.key)}
              className="group/kpi cursor-pointer rounded-xl text-left focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none disabled:cursor-default"
            >
              <StatCard
                label={c.label}
                value={c.count}
                hint={c.hint}
                badge={
                  c.count === 0
                    ? { text: 'Clear', tone: 'success', icon: <CheckCircle size={11} weight="fill" /> }
                    : selected
                      ? { text: 'Showing', tone: 'accent' }
                      : undefined
                }
                className={cn(
                  'h-full transition-[background-color,box-shadow] duration-150',
                  selected ? 'ring-1 ring-accent-ring' : c.count > 0 && 'group-hover/kpi:bg-surface-2/70',
                )}
              />
            </button>
          );
        })}
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden max-[900px]:overflow-visible">
        <Tabs
          value={active}
          onValueChange={(v) => setTab(v as TabKey)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b border-hairline-soft px-5 pt-3">
            <TabsList variant="underline" aria-label="Category" className="-mb-px w-fit shadow-none">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="flex-none px-2.5">
                  {t.label}
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-faint tabular-nums group-data-[state=active]:text-ink-muted">
                    {t.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Unused exports ── */}
          <TabsContent value="exports" className="flex min-h-0 flex-1 flex-col outline-none">
            <Toolbar
              description="Exported but never imported anywhere in the project."
              search={<SearchField value={query} onChange={setQuery} placeholder="Search unused exports…" className="max-w-xs min-w-48" />}
              filters={
                typesPresent.length > 1 && (
                  <ToggleGroup type="multiple" value={typeFilter} onValueChange={setTypeFilter} aria-label="Filter by type">
                    {typesPresent.map((t) => (
                      <ToggleGroupItem key={t} value={t} title={`Show only ${t}`}>
                        {t}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )
              }
              count={<FilterCount shown={unusedList.length} total={deadExports.length} />}
            />
            {unusedList.length === 0 ? (
              <NoMatches
                onClear={() => {
                  setQuery('');
                  setTypeFilter([]);
                }}
              />
            ) : (
              <div className={BODY_CLASS}>
                <table className={TABLE_CLASS}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unusedList.map((d) => (
                      <tr key={d.id}>
                        <td className="font-mono font-medium text-ink">{d.name}</td>
                        <td>
                          <TypeBadge type={d.type} />
                        </td>
                        <td className="max-w-0 w-[55%]">
                          <EditorLink
                            root={root}
                            path={d.path}
                            line={assetById.get(d.id)?.location?.line}
                            className="text-[12.5px] text-ink-muted"
                          >
                            <span className="min-w-0 truncate font-mono">{d.path}</span>
                          </EditorLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Orphan files ── */}
          <TabsContent value="orphans" className="flex min-h-0 flex-1 flex-col outline-none">
            <Toolbar
              description="Files where every export is unused — safe-to-delete candidates."
              search={<SearchField value={orphanQuery} onChange={setOrphanQuery} placeholder="Search orphan files…" className="max-w-xs min-w-48" />}
              count={<FilterCount shown={orphanList.length} total={orphanFiles.length} />}
            />
            {orphanList.length === 0 ? (
              <NoMatches onClear={() => setOrphanQuery('')} />
            ) : (
              <div className={BODY_CLASS}>
                <ul className="m-0 flex list-none flex-col p-0 pb-2">
                  {orphanList.map((f) => (
                    <li
                      key={f}
                      className="flex h-10 min-w-0 items-center gap-2.5 border-b border-hairline-soft px-5 transition-colors last:border-b-0 hover:bg-surface-2/50"
                    >
                      <FileDashed size={15} className="shrink-0 text-ink-faint" aria-hidden="true" />
                      <EditorLink root={root} path={f} className="text-[12.5px] text-ink-muted">
                        <span className="min-w-0 truncate font-mono">{f}</span>
                      </EditorLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ── Duplicate candidates ── */}
          <TabsContent value="duplicates" className="flex min-h-0 flex-1 flex-col outline-none">
            <Toolbar
              description="Same name (or near-identical body) declared in more than one file — possible consolidation targets."
              search={<SearchField value={dupQuery} onChange={setDupQuery} placeholder="Search duplicates…" className="max-w-xs min-w-48" />}
              count={<FilterCount shown={dupList.length} total={duplicates.length} />}
            />
            {dupList.length === 0 ? (
              <NoMatches onClear={() => setDupQuery('')} />
            ) : (
              <div className={BODY_CLASS}>
                <ul className="m-0 flex list-none flex-col gap-2.5 px-5 pt-1 pb-5">
                  {dupList.map((d) => (
                    <li
                      key={d.ids.join('|')}
                      className="rounded-lg px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--color-hairline-soft)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Copy size={15} className="shrink-0 text-ink-faint" aria-hidden="true" />
                        <span className="font-mono text-[13px] font-medium text-ink">{d.names.join(', ')}</span>
                        <Badge variant="warn">
                          {d.similarity >= 0.999 ? 'Exact match' : `${Math.round(d.similarity * 100)}% match`}
                        </Badge>
                        <span className="text-[12px] text-ink-faint">{d.reason}</span>
                      </div>
                      <div className="mt-2 ml-6 flex flex-col gap-1">
                        {d.ids.map((id) => (
                          <EditorLink
                            key={id}
                            root={root}
                            path={idPath(id)}
                            line={assetById.get(id)?.location?.line}
                            className="w-fit text-[12.5px] text-ink-muted"
                          >
                            <span className="min-w-0 truncate font-mono">{idPath(id)}</span>
                          </EditorLink>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

function Toolbar({
  description,
  search,
  filters,
  count,
}: {
  description: string;
  search: ReactNode;
  filters?: ReactNode;
  count: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5 px-5 pt-3.5 pb-3">
      <p className="m-0 w-full text-[12.5px] text-ink-faint">{description}</p>
      {search}
      {filters}
      <span className="ml-auto">{count}</span>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<FunnelSimple size={20} />}
      title="Nothing matches your filters"
      action={
        <Button size="sm" variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}
