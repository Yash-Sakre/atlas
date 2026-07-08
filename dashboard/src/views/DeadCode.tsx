import { useMemo, useState } from 'react';
import {
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiFile,
  FiInbox,
} from 'react-icons/fi';
import { useData } from '../data';
import type { Asset, AssetType } from '../types';
import { EditorLink, SearchField, TypeBadge, useFuzzy } from '../ui';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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

async function copyLines(lines: string[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    return true;
  } catch {
    return false;
  }
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

  // ── Unused exports: search + type filter ──
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const fuzzy = useFuzzy(deadExports, ['name', 'path']);

  const typesPresent = useMemo(
    () => TYPE_ORDER.filter((t) => deadExports.some((d) => d.type === t)),
    [deadExports],
  );

  const unusedList = useMemo(() => {
    let base = fuzzy(query);
    if (typeFilter.length) base = base.filter((d) => typeFilter.includes(d.type));
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, deadExports]);

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

      {/* ── Unused exports ── */}
      {deadExports.length > 0 && (
        <section className="atlas-panel atlas-deadsection atlas-deadsection--fill">
          <div className="atlas-panel-head">
            <h2 className="atlas-section-title">Unused exports</h2>
            <div className="atlas-deadhead-actions">
              <span className="atlas-panel-hint tnum">
                {unusedList.length} / {deadExports.length}
              </span>
            </div>
          </div>
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
          </div>

          {unusedList.length === 0 ? (
            <div className="atlas-empty">
              <FiInbox size={24} strokeWidth={1.6} />
              <p>No unused exports match your filters.</p>
            </div>
          ) : (
            <div className="atlas-table-wrap">
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
        </section>
      )}

      {/* ── Orphan files ── */}
      {orphanFiles.length > 0 && (
        <section className="atlas-panel atlas-deadsection">
          <div className="atlas-panel-head">
            <h2 className="atlas-section-title">Orphan files</h2>
            <div className="atlas-deadhead-actions">
              <span className="atlas-panel-hint tnum">{orphanFiles.length}</span>
            </div>
          </div>
          <p className="atlas-deadnote atlas-faint">
            Files where every export is unused — safe-to-delete candidates.
          </p>
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
        </section>
      )}

    </>
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

function CopyButton({ lines, title }: { lines: string[]; title: string }) {
  const [done, setDone] = useState(false);
  if (!lines.length) return null;
  return (
    <button
      type="button"
      className="atlas-copybtn"
      title={title}
      onClick={async () => {
        if (await copyLines(lines)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }
      }}
    >
      {done ? <FiCheck size={13} /> : <FiCopy size={13} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
