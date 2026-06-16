import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';
import { useData } from '../data';
import { SearchField, TypeBadge, useFuzzy } from '../ui';
import type { SearchRecord } from '../types';

const CARDS: Array<[string, keyof ReturnType<typeof statsTuple>, string, string]> = [
  ['Components', 'components', '/components', '#7fc4ff'],
  ['Hooks', 'hooks', '/hooks', '#c0a8ff'],
  ['Utils', 'utils', '/utils', '#7be3a8'],
  ['Contexts', 'contexts', '/contexts', '#ffce85'],
  ['Routes', 'routes', '/routes', '#e6a3ff'],
];

function statsTuple() {
  return { components: 0, hooks: 0, utils: 0, contexts: 0, routes: 0 };
}

const PAGE_FOR: Record<string, string> = {
  component: '/components',
  hook: '/hooks',
  utility: '/utils',
  context: '/contexts',
  store: '/contexts',
  provider: '/contexts',
  route: '/routes',
};

/** Last path segment, e.g. "/home/yash/Repo/chat-pdf" → "chat-pdf". */
function folderName(p: string): string {
  if (!p) return p;
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** ISO timestamp → readable local time, e.g. "Jun 15, 2026, 2:41 PM". */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Overview() {
  const data = useData();
  const s = data.stats;
  const fw = data.meta.framework;

  const [query, setQuery] = useState('');
  const search = useFuzzy(data.search || [], ['name', 'path', 'description', 'tags', 'keywords']);
  const hits = useMemo(
    () => (query.trim() ? search(query).slice(0, 12) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query],
  );

  const fwTags = [
    fw.react && 'React',
    fw.next && `Next.js (${fw.nextRouter})`,
    fw.vite && 'Vite',
    fw.reactRouter && 'React Router',
    ...(fw.stateLibs || []),
  ].filter(Boolean) as string[];

  const totalAssets = s.components + s.hooks + s.utils + s.contexts + s.routes;
  const healthIssues = s.unusedExports + s.duplicateCandidates;

  const warnings = useMemo(() => {
    const dc = data.deadCode || {};
    const groups: Array<[string, unknown[]]> = [
      ['Unused components', (dc.unusedComponents as unknown[]) || []],
      ['Unused hooks', (dc.unusedHooks as unknown[]) || []],
      ['Unused utils', (dc.unusedUtils as unknown[]) || []],
      ['Unused contexts', (dc.unusedContexts as unknown[]) || []],
      ['Dead exports', (dc.deadExports as unknown[]) || []],
      ['Orphan files', (dc.orphanFiles as unknown[]) || []],
      ['Duplicate candidates', (dc.duplicateCandidates as unknown[]) || []],
    ];
    return groups.map(([label, arr]) => ({ label, n: arr.length }));
  }, [data.deadCode]);

  return (
    <>
      <div className="mb-10">
        <p className="atlas-eyebrow">Codebase atlas</p>
        <h1 className="atlas-page-title">Overview</h1>
        <p className="atlas-lead">
          Analyzed{' '}
          <span className="mono atlas-muted" title={data.meta.root}>
            {folderName(data.meta.root)}
          </span>{' '}
          &middot; generated {formatTime(data.meta.generatedAt)}
        </p>
      </div>

      <div className="atlas-field mb-12" style={{ position: 'relative' }}>
        {/* <SearchField value={query} onChange={setQuery} placeholder="Search all assets — name, path, description…" large /> */}
        {hits.length > 0 && (
          <div className="atlas-card mt-3" style={{ overflow: 'hidden', padding: 0 }}>
            {hits.map((r: SearchRecord) => (
              <Link
                key={r.id}
                to={PAGE_FOR[r.type] || '/'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 18px',
                  borderBottom: '1px solid var(--hairline-soft)',
                  textDecoration: 'none',
                }}
              >
                <TypeBadge type={r.type} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mono" style={{ color: 'var(--ink)' }}>{r.name}</span>
                  <span className="mono atlas-faint atlas-trunc" style={{ display: 'block', fontSize: 11 }}>
                    {r.path}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="atlas-eyebrow">Asset breakdown</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        {CARDS.map(([label, key, href, color]) => (
          <Link key={href} to={href} className="atlas-card atlas-stat">
            <span className="atlas-stat-arrow">
              <FiArrowUpRight size={16} />
            </span>
            <div className="atlas-stat-value">{(s as unknown as Record<string, number>)[key]}</div>
            <div className="atlas-stat-label">{label}</div>
            <div className="atlas-stat-accent" style={{ background: color }} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        <div className="atlas-spotlight atlas-spotlight--violet">
          <div>
            <p className="atlas-spotlight-eyebrow">Mapped surface</p>
            <p className="atlas-spotlight-stat">{totalAssets}</p>
          </div>
          <p className="atlas-spotlight-body">
            Reusable assets discovered across {s.fileCount} files — components, hooks, utilities,
            contexts and routes, fully cross-referenced.
          </p>
        </div>
        <div className={`atlas-spotlight ${healthIssues ? 'atlas-spotlight--orange' : 'atlas-spotlight--coral'}`}>
          <div>
            <p className="atlas-spotlight-eyebrow">Cleanup signal</p>
            <p className="atlas-spotlight-stat">{healthIssues}</p>
          </div>
          <p className="atlas-spotlight-body">
            {s.unusedExports} unused export{s.unusedExports === 1 ? '' : 's'} and{' '}
            {s.duplicateCandidates} duplicate candidate{s.duplicateCandidates === 1 ? '' : 's'} worth
            a second look.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="atlas-card" style={{ padding: 24 }}>
          <h2 className="atlas-section-title mb-5">Warnings</h2>
          <div className="space-y-3" style={{ fontSize: 14 }}>
            {warnings.map((w) => (
              <div key={w.label} className="flex items-start justify-between gap-3">
                <span style={{ color: 'var(--ink)' }}>
                  {w.n ? '⚠️' : '✅'} {w.label}
                </span>
                <span style={{ fontWeight: 600, color: w.n ? '#ffce85' : 'var(--success)' }}>{w.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="atlas-card" style={{ padding: 24 }}>
          <h2 className="atlas-section-title mb-5">Project</h2>
          <dl className="space-y-3" style={{ fontSize: 14 }}>
            <Row label="Files scanned" value={s.fileCount} />
            <Row label="Unused exports" value={s.unusedExports} />
            <Row label="Duplicate candidates" value={s.duplicateCandidates} />
            <Row label="Analysis time" value={`${s.durationMs} ms`} />
            <Row label="Tool version" value={data.meta.toolVersion} mono />
          </dl>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {fwTags.map((t) => (
              <span key={t} className="atlas-tag">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="atlas-muted">{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}
