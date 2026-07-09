import { useMemo, useState } from 'react';
import { FiCheckCircle, FiCopy, FiFile, FiInbox } from 'react-icons/fi';
import { useData } from '../data';
import type { Asset, AssetType } from '../types';
import { EditorLink, SearchField, TypeBadge, useFuzzy } from '../ui';
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
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? 'exports';

  // ── Unused exports: search + type filter ──
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const fuzzyExports = useFuzzy(deadExports, ['name', 'path']);
  const typesPresent = useMemo(
    () => TYPE_ORDER.filter((t) => deadExports.some((d) => d.type === t)),
    [deadExports],
  );
  const unusedList = useMemo(() => {
    let base = fuzzyExports(query);
    if (typeFilter.length) base = base.filter((d) => typeFilter.includes(d.type));
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, deadExports]);

  // ── Duplicates: search over names + file paths ──
  const [dupQuery, setDupQuery] = useState('');
  const dupIndexed = useMemo(
    () =>
      duplicates.map((d) => ({
        ...d,
        _names: d.names.join(' '),
        _paths: d.ids.map(idPath).join(' '),
      })),
    [duplicates],
  );
  const fuzzyDupes = useFuzzy(dupIndexed, ['_names', '_paths']);
  const dupList = useMemo(() => fuzzyDupes(dupQuery), [dupQuery, fuzzyDupes]);

  if (total === 0) {
    return (
      <>
        <Head total={0} />
        <div className="atlas-panel atlas-deadclear">
          <FiCheckCircle size={28} style={{ color: 'var(--success)' }} />
          <div>
            <h2 className="atlas-section-title" style={{ marginBottom: 4 }}>No dead code found</h2>
            <p className="atlas-faint">
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

      <section className="atlas-panel atlas-deadpanel">
        <div className="atlas-panel-head atlas-deadtabs-head">
          {tabs.length > 1 ? (
            <Tabs value={active} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.key} value={t.key}>
                    {t.label}
                    <span className="atlas-tabcount tnum">{t.count}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <h2 className="atlas-section-title">{tabs[0]?.label}</h2>
          )}
        </div>

        {/* ── Unused exports ── */}
        {active === 'exports' && (
          <>
            <div className="atlas-deadtoolbar">
              <p className="atlas-deadnote atlas-faint">
                Exported but never imported anywhere in the project.
              </p>
              <div className="atlas-deadfilters">
                <SearchField value={query} onChange={setQuery} placeholder="Search unused exports…" />
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
                <span className="atlas-filter-count">
                  <b>{unusedList.length}</b> / {deadExports.length}
                </span>
              </div>
            </div>

            {unusedList.length === 0 ? (
              <Empty label="No unused exports match your filters." />
            ) : (
              <div className="atlas-deadbody">
                <table className="atlas-table atlas-deadtable">
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
                        <td className="mono">{d.name}</td>
                        <td>
                          <TypeBadge type={d.type} />
                        </td>
                        <td>
                          <EditorLink
                            root={root}
                            path={d.path}
                            line={assetById.get(d.id)?.location?.line}
                            className="atlas-deadloc"
                          >
                            <span className="mono atlas-trunc">{d.path}</span>
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
            <div className="atlas-deadtoolbar">
              <p className="atlas-deadnote atlas-faint">
                Files where every export is unused — safe-to-delete candidates.
              </p>
            </div>
            <div className="atlas-deadbody">
              <ul className="atlas-deadfiles">
                {orphanFiles.map((f) => (
                  <li key={f} className="atlas-deadfile">
                    <FiFile className="atlas-deadfile-icon" aria-hidden="true" />
                    <EditorLink root={root} path={f} className="atlas-deadloc">
                      <span className="mono atlas-trunc">{f}</span>
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
            <div className="atlas-deadtoolbar">
              <p className="atlas-deadnote atlas-faint">
                Same name (or near-identical body) declared in more than one file — possible
                consolidation targets.
              </p>
              <div className="atlas-deadfilters">
                <SearchField
                  value={dupQuery}
                  onChange={setDupQuery}
                  placeholder="Search duplicates…"
                />
                <span className="atlas-filter-count">
                  <b>{dupList.length}</b> / {duplicates.length}
                </span>
              </div>
            </div>

            {dupList.length === 0 ? (
              <Empty label="No duplicates match your search." />
            ) : (
              <div className="atlas-deadbody">
                <ul className="atlas-duprows">
                  {dupList.map((d) => (
                    <li key={d.ids.join('|')} className="atlas-duprow">
                      <div className="atlas-duprow-head">
                        <FiCopy className="atlas-deadfile-icon" aria-hidden="true" />
                        <span className="mono atlas-dupname">{d.names.join(', ')}</span>
                        {d.similarity >= 0.999 ? (
                          <span className="atlas-pill atlas-dupsim">exact</span>
                        ) : (
                          <span className="atlas-pill atlas-dupsim tnum">
                            {Math.round(d.similarity * 100)}% match
                          </span>
                        )}
                        <span className="atlas-dupreason atlas-faint">{d.reason}</span>
                      </div>
                      <div className="atlas-dupfiles">
                        {d.ids.map((id) => (
                          <EditorLink
                            key={id}
                            root={root}
                            path={idPath(id)}
                            line={assetById.get(id)?.location?.line}
                            className="atlas-deadloc"
                          >
                            <span className="mono atlas-trunc">{idPath(id)}</span>
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
    <div className="atlas-empty atlas-deadbody">
      <FiInbox size={24} strokeWidth={1.6} />
      <p>{label}</p>
    </div>
  );
}

function Head({ total }: { total: number }) {
  return (
    <div className="atlas-pagehead">
      <div className="atlas-pagehead-main">
        <h1 className="atlas-pagehead-title">Dead code</h1>
        <p className="atlas-pagehead-sub">
          Exports nothing references, orphaned files, and likely duplicates — click any path to open
          it in your editor.
        </p>
      </div>
      <div className="atlas-pagehead-side">
        <span
          className="atlas-pill"
          style={{ color: total ? 'var(--warn)' : 'var(--success)' }}
        >
          <span className="atlas-dot" style={{ background: 'currentColor' }} />
          {total ? `${total} to review` : 'All clear'}
        </span>
      </div>
    </div>
  );
}
