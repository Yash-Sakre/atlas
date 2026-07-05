import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiCheck } from 'react-icons/fi';
import { useData } from '../data';
import CompositionChart from '../components/CompositionChart';
import { SearchField, TypeBadge, EditorLink, useFuzzy } from '../ui';
import type { Asset, SearchRecord } from '../types';

type CardKey = 'components' | 'hooks' | 'utils' | 'contexts' | 'routes';

const CARDS: Array<{ label: string; key: CardKey; href: string; hue: string }> = [
  { label: 'Components', key: 'components', href: '/components', hue: 'var(--t-component)' },
  { label: 'Hooks', key: 'hooks', href: '/hooks', hue: 'var(--t-hook)' },
  { label: 'Utils', key: 'utils', href: '/utils', hue: 'var(--t-utility)' },
  { label: 'Contexts', key: 'contexts', href: '/contexts', hue: 'var(--t-context)' },
  { label: 'Routes', key: 'routes', href: '/routes', hue: 'var(--t-route)' },
];

/** Per-type hue for the leaderboard bars (mirrors the legend palette). */
const TYPE_HUE: Record<string, string> = {
  component: 'var(--t-component)',
  hook: 'var(--t-hook)',
  utility: 'var(--t-utility)',
  context: 'var(--t-context)',
  store: 'var(--t-store)',
  provider: 'var(--t-provider)',
  route: 'var(--t-route)',
};

const PAGE_FOR: Record<string, string> = {
  component: '/components',
  hook: '/hooks',
  utility: '/utils',
  context: '/contexts',
  store: '/contexts',
  provider: '/contexts',
  route: '/routes',
};

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
    () => (query.trim() ? search(query).slice(0, 8) : []),
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

  const counts = CARDS.map((c) => (s as unknown as Record<string, number>)[c.key] || 0);
  const totalAssets = counts.reduce((a, b) => a + b, 0);

  // Every reusable asset flattened once — drives reusability + the leaderboard.
  const allAssets = useMemo<Asset[]>(
    () => [
      ...(data.components || []),
      ...(data.hooks || []),
      ...(data.utils || []),
      ...(data.contexts || []),
      ...(data.routes || []),
    ],
    [data],
  );

  // How reusable is the codebase? Split assets by how many places reference them.
  const reuse = useMemo(() => {
    const total = allAssets.length;
    const reused = allAssets.filter((a) => (a.usageCount || 0) >= 2).length;
    const once = allAssets.filter((a) => (a.usageCount || 0) === 1).length;
    const unused = total - reused - once;
    const pct = total ? Math.round((reused / total) * 100) : 0;
    return [
      { label: 'Reused (2+ places)', n: reused, hue: 'var(--success)', total, pct },
      { label: 'Used once', n: once, hue: 'var(--t-component)', total, pct },
      { label: 'Never referenced', n: unused, hue: 'var(--warn)', total, pct },
    ];
  }, [allAssets]);
  const reusedPct = reuse[0].pct;

  // Most referenced assets — a leaderboard of the load-bearing code.
  const topUsed = useMemo(
    () =>
      allAssets
        .filter((a) => (a.usageCount || 0) > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 6),
    [allAssets],
  );
  const maxUse = topUsed[0]?.usageCount || 1;

  const links = data.graph?.edges?.length || 0;

  const warnings = useMemo(() => {
    const dc = data.deadCode || {};
    const groups: Array<[string, unknown]> = [
      ['Unused components', dc.unusedComponents],
      ['Unused hooks', dc.unusedHooks],
      ['Unused utils', dc.unusedUtils],
      ['Unused contexts', dc.unusedContexts],
      ['Dead exports', dc.deadExports],
      ['Orphan files', dc.orphanFiles],
      ['Duplicate candidates', dc.duplicateCandidates],
    ];
    return groups.map(([label, arr]) => ({ label, n: Array.isArray(arr) ? arr.length : 0 }));
  }, [data.deadCode]);

  const issueTotal = warnings.reduce((a, w) => a + w.n, 0);

  return (
    <>
      <div className="atlas-pagehead">
        <div className="atlas-pagehead-main">
          <h1 className="atlas-pagehead-title">Overview</h1>
          <p className="atlas-pagehead-sub">
            <span className="mono atlas-muted" title={data.meta.root}>{folderName(data.meta.root)}</span>
            <span className="atlas-dot-sep">·</span>
            <span>{totalAssets} assets across {s.fileCount} files</span>
            <span className="atlas-dot-sep">·</span>
            <span className="atlas-faint">analyzed {formatTime(data.meta.generatedAt)}</span>
          </p>
        </div>
        <div className="atlas-pagehead-side">
          <div className="atlas-field" style={{ width: 'min(340px, 60vw)' }}>
            <SearchField value={query} onChange={setQuery} placeholder="Search everything…" />
            {hits.length > 0 && (
              <div className="atlas-card" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 30, overflow: 'hidden', boxShadow: '0 24px 56px -20px rgba(0,0,0,.7)' }}>
                {hits.map((r: SearchRecord) => (
                  <Link
                    key={r.id}
                    to={PAGE_FOR[r.type] || '/'}
                    onClick={() => setQuery('')}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--hairline-soft)', textDecoration: 'none' }}
                  >
                    <TypeBadge type={r.type} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="mono" style={{ color: 'var(--ink)', fontSize: 13 }}>{r.name}</span>
                      <span className="mono atlas-faint atlas-trunc" style={{ display: 'block', fontSize: 11 }}>{r.path}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="atlas-bento-stack">
        {/* KPI tiles */}
        <div className="atlas-kpis">
          {CARDS.map((c, i) => {
            const n = counts[i];
            const share = totalAssets ? Math.max(6, (n / totalAssets) * 100) : 0;
            return (
              <Link key={c.href} to={c.href} className="atlas-kpi">
                <span className="atlas-kpi-arrow"><FiArrowUpRight size={15} /></span>
                <div className="atlas-kpi-top">
                  <span className="atlas-kpi-dot" style={{ background: c.hue }} />
                  <span className="atlas-kpi-label">{c.label}</span>
                </div>
                <div className="atlas-kpi-num">{n}</div>
                <div className="atlas-kpi-bar">
                  <span style={{ width: `${share}%`, background: c.hue }} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Composition + Reusability */}
        {totalAssets > 0 && (
          <div className="atlas-bento-row atlas-bento-row--grow grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
            <div className="atlas-panel atlas-panel-chart">
              <div className="atlas-panel-head">
                <h2 className="atlas-section-title">Composition</h2>
                <span className="atlas-panel-hint">{totalAssets} reusable assets</span>
              </div>
              <CompositionChart
                data={CARDS.map((c, i) => ({
                  key: c.key,
                  label: c.label,
                  value: counts[i],
                  hue: c.hue,
                }))}
              />
            </div>

            <div className="atlas-panel">
              <div className="atlas-panel-head">
                <h2 className="atlas-section-title">Reusability</h2>
                <span className="atlas-panel-hint">across {allAssets.length} assets</span>
              </div>
              <div className="atlas-reuse-headline">
                <span className="atlas-reuse-pct">{reusedPct}%</span>
                <span className="atlas-reuse-pct-label">reused in 2+ places</span>
              </div>
              <div className="atlas-reuse-rows">
                {reuse.map((r) => {
                  const w = r.total ? Math.max(r.n ? 4 : 0, (r.n / r.total) * 100) : 0;
                  return (
                    <div key={r.label} className="atlas-reuse-row">
                      <div className="atlas-reuse-line">
                        <span className="atlas-legend-dot" style={{ background: r.hue }} />
                        {r.label}
                        <b>{r.n}</b>
                      </div>
                      <div className="atlas-reuse-track">
                        <span style={{ width: `${w}%`, background: r.hue }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Most referenced + Health */}
        <div className="atlas-bento-row atlas-bento-row--grow grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
          <div className="atlas-panel">
            <div className="atlas-panel-head">
              <h2 className="atlas-section-title">Most referenced</h2>
              <span className="atlas-panel-hint">{links} dependency links</span>
            </div>
            {topUsed.length > 0 ? (
              <div className="atlas-lead">
                {topUsed.map((a, i) => (
                  <div key={a.id} className="atlas-lead-row">
                    <span className="atlas-lead-rank">{i + 1}</span>
                    <TypeBadge type={a.type} />
                    <span className="atlas-lead-name">
                      <EditorLink
                        root={data.meta.root}
                        path={a.location?.filePath || a.path}
                        line={a.location?.line}
                        column={a.location?.column}
                      >
                        <span className="atlas-trunc mono" title={a.name}>{a.name}</span>
                      </EditorLink>
                    </span>
                    <span className="atlas-lead-bar">
                      <span
                        style={{
                          width: `${Math.max(6, ((a.usageCount || 0) / maxUse) * 100)}%`,
                          background: TYPE_HUE[a.type] || 'var(--ink-faint)',
                        }}
                      />
                    </span>
                    <span className="atlas-lead-count">{a.usageCount || 0}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="atlas-faint" style={{ fontSize: 13.5 }}>No references detected yet.</p>
            )}
          </div>

          <div className="atlas-panel">
            <div className="atlas-panel-head">
              <h2 className="atlas-section-title">Health</h2>
              <span
                className="atlas-pill"
                style={{ color: issueTotal ? 'var(--warn)' : 'var(--success)' }}
              >
                <span className="atlas-dot" style={{ background: 'currentColor' }} />
                {issueTotal ? `${issueTotal} to review` : 'All clear'}
              </span>
            </div>
            <div className="atlas-rows">
              {warnings.map((w) => (
                <div key={w.label} className="atlas-lrow">
                  <span
                    className="atlas-status-dot"
                    style={{ background: w.n ? 'var(--warn)' : 'var(--success)' }}
                  />
                  <span className="atlas-lrow-label">{w.label}</span>
                  {w.n ? (
                    <span className="atlas-lrow-val" style={{ color: 'var(--warn)' }}>{w.n}</span>
                  ) : (
                    <span className="atlas-lrow-val atlas-faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FiCheck size={13} /> 0
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="atlas-ministat">
      <span className="atlas-ministat-num">{value}</span>
      <span className="atlas-ministat-label">{label}</span>
    </div>
  );
}
