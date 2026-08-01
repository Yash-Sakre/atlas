import { useMemo, useState } from 'react';
import { FiCheckCircle, FiCopy, FiFile, FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset, AssetType } from '../types';
import { EditorLink, SearchField, TypeBadge, useSearch } from '../ui';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Mirrors the analyzer's dead-code report (loosely — every field optional). */
interface DeadItem {
  id: string;
  name: string;
  path: string;
  type: AssetType;
}
interface DuplicateItem {
  ids: string[];
  names: string[];
  reason: string;
  similarity: number;
}
interface DeadCodeData {
  deadExports?: DeadItem[];
  orphanFiles?: string[];
  duplicateCandidates?: DuplicateItem[];
}

const TYPE_ORDER: AssetType[] = ['component', 'hook', 'utility', 'context', 'store', 'provider'];

type TabKey = 'exports' | 'orphans' | 'duplicates';

/** Shared table chrome: header row, hairline rules, sticky headers while scrolling. */
const TABLE_CLASS =
  'w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-hairline-soft [&_td]:py-2.25 [&_td]:pr-4 [&_td]:text-ink-muted [&_td:first-child]:font-medium [&_td:first-child]:text-ink [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:border-b [&_th]:border-hairline-soft [&_th]:bg-surface-1 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12.5px] [&_th]:font-medium [&_th]:text-ink-muted [&_tr:last-child_td]:border-b-0';

/** The scrolling body of a tab — the only region that scrolls on this page. */
const BODY_CLASS = 'min-h-0 flex-auto overflow-y-auto overscroll-contain max-[900px]:overflow-y-visible';

/** The file path portion of an asset id like `apps/x/foo.ts#main`. */
function idPath(id: string): string {
  const hash = id.indexOf('#');
  return hash === -1 ? id : id.slice(0, hash);
}

export default function DeadCode() {
  const data = useData();
  const root = data.meta.root;
  const dc = (data.deadCode || {}) as DeadCodeData;

  const deadExports = dc.deadExports || [];
  const orphanFiles = dc.orphanFiles || [];
  const duplicates = dc.duplicateCandidates || [];
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

  // ── Which category tabs actually have items ──
  const tabs = useMemo(
    () =>
      (
        [
          { key: 'exports', label: 'Unused exports', count: deadExports.length },
          { key: 'orphans', label: 'Orphan files', count: orphanFiles.length },
          { key: 'duplicates', label: 'Duplicates', count: duplicates.length },
        ] as { key: TabKey; label: string; count: number }[]
      ).filter((t) => t.count > 0),
    [deadExports.length, orphanFiles.length, duplicates.length],
  );

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
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, deadExports]);

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
        <Head total={0} />
        <div className="flex items-center gap-4 rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
          <FiCheckCircle size={28} className="text-success" />
          <div>
            <h2 className="m-0 mb-1 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              No dead code found
            </h2>
            <p className="text-ink-faint">
              Every export is referenced, no orphan files, and no duplicate candidates.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head total={total} />

      <section className="flex min-h-0 flex-auto flex-col rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          {tabs.length > 1 ? (
            <Tabs value={active} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="group">
                    {t.label}
                    <span className="ml-1.75 rounded-full bg-surface-2 px-1.75 py-px text-[11px] tabular-nums text-ink-faint group-data-[state=active]:bg-surface-1 group-data-[state=active]:text-ink-muted">
                      {t.count}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              {tabs[0]?.label}
            </h2>
          )}
        </div>

        {/* ── Unused exports ── */}
        {active === 'exports' && (
          <>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <p className="m-0 text-[13px] text-ink-faint">
                Exported but never imported anywhere in the project.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search unused exports…"
                />
                {typesPresent.length > 1 && (
                  <ToggleGroup
                    type="multiple"
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                    className="flex flex-wrap gap-1.5"
                  >
                    {typesPresent.map((t) => (
                      <ToggleGroupItem key={t} value={t} title={`Show only ${t}`}>
                        {t}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
                <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-ink-faint">
                  <b className="font-semibold text-ink-muted">{unusedList.length}</b> /{' '}
                  {deadExports.length}
                </span>
              </div>
            </div>

            {unusedList.length === 0 ? (
              <Empty label="No unused exports match your filters." />
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
                        <td className="font-mono tracking-normal">{d.name}</td>
                        <td>
                          <TypeBadge type={d.type} />
                        </td>
                        <td>
                          <EditorLink
                            root={root}
                            path={d.path}
                            line={assetById.get(d.id)?.location?.line}
                            className="text-[12.5px] text-ink-muted"
                          >
                            <span className="min-w-0 truncate font-mono tracking-normal">
                              {d.path}
                            </span>
                          </EditorLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Orphan files ── */}
        {active === 'orphans' && (
          <>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <p className="m-0 text-[13px] text-ink-faint">
                Files where every export is unused — safe-to-delete candidates.
              </p>
            </div>
            <div className={BODY_CLASS}>
              <ul className="flex flex-col gap-px">
                {orphanFiles.map((f) => (
                  <li
                    key={f}
                    className="flex min-w-0 items-center gap-2.25 rounded-sm p-2 hover:bg-surface-2"
                  >
                    <FiFile className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                    <EditorLink root={root} path={f} className="text-[12.5px] text-ink-muted">
                      <span className="min-w-0 truncate font-mono tracking-normal">{f}</span>
                    </EditorLink>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ── Duplicate candidates ── */}
        {active === 'duplicates' && (
          <>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <p className="m-0 text-[13px] text-ink-faint">
                Same name (or near-identical body) declared in more than one file — possible
                consolidation targets.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <SearchField
                  value={dupQuery}
                  onChange={setDupQuery}
                  placeholder="Search duplicates…"
                />
                <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-ink-faint">
                  <b className="font-semibold text-ink-muted">{dupList.length}</b> /{' '}
                  {duplicates.length}
                </span>
              </div>
            </div>

            {dupList.length === 0 ? (
              <Empty label="No duplicates match your search." />
            ) : (
              <div className={BODY_CLASS}>
                <ul className="flex flex-col">
                  {dupList.map((d) => (
                    <li
                      key={d.ids.join('|')}
                      className="border-b border-hairline-soft px-0.5 py-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <FiCopy className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                        <span className="font-mono text-[13.5px] font-medium tracking-normal text-ink">
                          {d.names.join(', ')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.75 py-1 text-[10.5px] font-medium tabular-nums text-warn">
                          {d.similarity >= 0.999 ? 'exact' : `${Math.round(d.similarity * 100)}% match`}
                        </span>
                        <span className="text-xs text-ink-faint">{d.reason}</span>
                      </div>
                      <div className="mt-1.75 ml-5.75 flex flex-col gap-0.75">
                        {d.ids.map((id) => (
                          <EditorLink
                            key={id}
                            root={root}
                            path={idPath(id)}
                            line={assetById.get(id)?.location?.line}
                            className="text-[12.5px] text-ink-muted"
                          >
                            <span className="min-w-0 truncate font-mono tracking-normal">
                              {idPath(id)}
                            </span>
                          </EditorLink>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13.5px] text-ink-faint ${BODY_CLASS}`}
    >
      <FiInbox size={24} strokeWidth={1.6} />
      <p>{label}</p>
    </div>
  );
}

function Head({ total }: { total: number }) {
  return (
    <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
      <div className="min-w-0">
        <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
          Dead code
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          Exports nothing references, orphaned files, and likely duplicates — click any path to open
          it in your editor.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium ${
            total ? 'text-warn' : 'text-success'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {total ? `${total} to review` : 'All clear'}
        </span>
      </div>
    </div>
  );
}
