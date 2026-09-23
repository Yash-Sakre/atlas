import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiCheck } from 'react-icons/fi';
import { useData } from '../data';
import CompositionChart from '../components/CompositionChart';
import { SearchField, TypeBadge, EditorLink, useSearch } from '../ui';
import type { Asset, SearchRecord } from '../types';

type CardKey = 'components' | 'hooks' | 'utils' | 'contexts' | 'routes';

const CARDS: Array<{ label: string; key: CardKey; href: string; hue: string }> = [
  { label: 'Components', key: 'components', href: '/components', hue: 'var(--color-t-component)' },
  { label: 'Hooks', key: 'hooks', href: '/hooks', hue: 'var(--color-t-hook)' },
  { label: 'Utils', key: 'utils', href: '/utils', hue: 'var(--color-t-utility)' },
  { label: 'Contexts', key: 'contexts', href: '/contexts', hue: 'var(--color-t-context)' },
  { label: 'Routes', key: 'routes', href: '/routes', hue: 'var(--color-t-route)' },
];

/** Per-type hue for the leaderboard bars (mirrors the legend palette). */
const TYPE_HUE: Record<string, string> = {
  component: 'var(--color-t-component)',
  hook: 'var(--color-t-hook)',
  utility: 'var(--color-t-utility)',
  context: 'var(--color-t-context)',
  store: 'var(--color-t-store)',
  provider: 'var(--color-t-provider)',
  route: 'var(--color-t-route)',
};

/** Dependency-kind hue for the "Most imported" leaderboard dots. */
const DEP_KIND_HUE: Record<string, string> = {
  prod: 'var(--color-success)',
  dev: 'var(--color-t-component)',
  peer: 'var(--color-t-hook)',
  optional: 'var(--color-t-hook)',
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

  const [query, setQuery] = useState('');
  const search = useSearch(data.search || [], ['name']);
  const hits = useMemo(
    () => (query.trim() ? search(query).slice(0, 8) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, data.search],
  );

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
      { label: 'Reused (2+ places)', n: reused, hue: 'var(--color-success)', total, pct },
      { label: 'Used once', n: once, hue: 'var(--color-t-component)', total, pct },
      { label: 'Never referenced', n: unused, hue: 'var(--color-warn)', total, pct },
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

  // Declared third-party packages (offline-derivable; the full view enriches
  // each one live from the npm registry).
  const deps = data.dependencies?.dependencies || [];
  const depCounts = data.dependencies?.counts;
  const depUnused = deps.filter((d) => (d.usedInCount || 0) === 0).length;
  const depBreakdown = depCounts
    ? [
        { label: 'Production', n: depCounts.prod, hue: 'var(--color-success)' },
        { label: 'Development', n: depCounts.dev, hue: 'var(--color-t-component)' },
        {
          label: 'Peer / optional',
          n: depCounts.peer + depCounts.optional,
          hue: 'var(--color-t-hook)',
        },
      ].filter((r) => r.n > 0)
    : [];
  const topDeps = useMemo(
    () =>
      [...deps]
        .filter((d) => (d.usedInCount || 0) > 0)
        .sort((a, b) => (b.usedInCount || 0) - (a.usedInCount || 0))
        .slice(0, 6),
    [deps],
  );
  const maxDepUse = topDeps[0]?.usedInCount || 1;

  return (
    <>
      <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
            Overview
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="font-mono tracking-normal text-ink-muted" title={data.meta.root}>
              {folderName(data.meta.root)}
            </span>
            <span className="text-ink-faint">·</span>
            <span>
              {totalAssets} assets across {s.fileCount} files
            </span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-faint">analyzed {formatTime(data.meta.generatedAt)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative w-[min(340px,60vw)]">
            <SearchField value={query} onChange={setQuery} placeholder="Search everything…" />
            {hits.length > 0 && (
              <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 overflow-hidden rounded-lg bg-surface-1 shadow-[0_24px_56px_-20px_rgba(0,0,0,0.7)]">
                {hits.map((r: SearchRecord) => (
                  <Link
                    key={r.id}
                    to={PAGE_FOR[r.type] || '/'}
                    onClick={() => setQuery('')}
                    className="flex items-center gap-3 border-b border-hairline-soft px-3.5 py-2.5 no-underline"
                  >
                    <TypeBadge type={r.type} />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[13px] tracking-normal text-ink">
                        {r.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] tracking-normal text-ink-faint">
                        {r.path}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-5 gap-4 max-[1180px]:grid-cols-3 max-[620px]:grid-cols-2">
          {CARDS.map((c, i) => {
            const n = counts[i];
            const share = totalAssets ? Math.max(6, (n / totalAssets) * 100) : 0;
            return (
              <Link
                key={c.href}
                to={c.href}
                className="group relative flex flex-col gap-3 rounded-2xl bg-surface-1 px-4.5 pt-4.5 pb-4.25 shadow-card transition-[background-color,transform] duration-140 hover:-translate-y-0.5 hover:bg-surface-2"
              >
                <span className="absolute top-3.5 right-3.5 translate-x-[-2px] translate-y-[2px] text-ink-faint transition-[opacity,transform,color] duration-140 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-ink">
                  <FiArrowUpRight size={15} />
                </span>
                <div className="flex items-center gap-1.75">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.hue }} />
                  <span className="text-[12.5px] tracking-[-0.01em] text-ink-muted">{c.label}</span>
                </div>
                <div className="font-display text-[34px] leading-[0.9] font-semibold tracking-[-0.04em] tabular-nums text-ink">
                  {n}
                </div>
                <div className="h-0.75 overflow-hidden rounded-[3px] bg-surface-3">
                  <span
                    className="block h-full rounded-[3px]"
                    style={{ width: `${share}%`, background: c.hue }}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Composition + Reusability */}
        {totalAssets > 0 && (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
              <div className="mb-4.5 flex items-center justify-between gap-3">
                <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Composition
                </h2>
                <span className="text-xs text-ink-faint">{totalAssets} reusable assets</span>
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

            <div className="rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
              <div className="mb-4.5 flex items-center justify-between gap-3">
                <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Reusability
                </h2>
                <span className="text-xs text-ink-faint">across {allAssets.length} assets</span>
              </div>
              <div className="mb-5 flex items-baseline gap-1.5">
                <span className="font-display text-[40px] leading-[0.9] font-semibold tracking-[-0.045em] tabular-nums text-ink">
                  {reusedPct}%
                </span>
                <span className="text-[13.5px] text-ink-muted">reused in 2+ places</span>
              </div>
              <div className="flex flex-col gap-3.5">
                {reuse.map((r) => {
                  const w = r.total ? Math.max(r.n ? 4 : 0, (r.n / r.total) * 100) : 0;
                  return (
                    <div key={r.label} className="flex flex-col gap-1.75">
                      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: r.hue }}
                        />
                        {r.label}
                        <b className="ml-auto font-semibold tabular-nums text-ink">{r.n}</b>
                      </div>
                      <div className="h-1.25 overflow-hidden rounded-[5px] bg-surface-2">
                        <span
                          className="block h-full rounded-[5px]"
                          style={{ width: `${w}%`, background: r.hue }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Most referenced + Health */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
            <div className="mb-4.5 flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                Most referenced
              </h2>
              <span className="text-xs text-ink-faint">{links} dependency links</span>
            </div>
            {topUsed.length > 0 ? (
              <div className="flex flex-col">
                {topUsed.map((a, i) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-[16px_auto_minmax(0,1fr)_88px_30px] items-center gap-2.75 border-t border-hairline-soft py-2.25 first:border-t-0"
                  >
                    <span className="text-right text-xs tabular-nums text-ink-faint">{i + 1}</span>
                    <TypeBadge type={a.type} />
                    <span className="min-w-0">
                      <EditorLink
                        root={data.meta.root}
                        path={a.location?.filePath || a.path}
                        line={a.location?.line}
                        column={a.location?.column}
                      >
                        <span
                          className="min-w-0 truncate font-mono text-[13px] tracking-normal text-ink"
                          title={a.name}
                        >
                          {a.name}
                        </span>
                      </EditorLink>
                    </span>
                    <span className="h-1.25 overflow-hidden rounded-[5px] bg-surface-2">
                      <span
                        className="block h-full rounded-[5px]"
                        style={{
                          width: `${Math.max(6, ((a.usageCount || 0) / maxUse) * 100)}%`,
                          background: TYPE_HUE[a.type] || 'var(--color-ink-faint)',
                        }}
                      />
                    </span>
                    <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
                      {a.usageCount || 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13.5px] text-ink-faint">No references detected yet.</p>
            )}
          </div>

          <div className="rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
            <div className="mb-4.5 flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                Health
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium ${
                  issueTotal ? 'text-warn' : 'text-success'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {issueTotal ? `${issueTotal} to review` : 'All clear'}
              </span>
            </div>
            <div className="flex flex-col">
              {warnings.map((w) => (
                <div
                  key={w.label}
                  className="flex items-center gap-2.75 border-t border-hairline-soft py-2.5 first:border-t-0"
                >
                  <span
                    className={`h-1.75 w-1.75 shrink-0 rounded-full ${
                      w.n ? 'bg-warn' : 'bg-success'
                    }`}
                  />
                  <span className="min-w-0 text-[13.5px] text-ink">{w.label}</span>
                  {w.n ? (
                    <span className="ml-auto text-[13.5px] font-semibold tabular-nums text-warn">
                      {w.n}
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1 text-[13.5px] font-semibold tabular-nums text-ink-faint">
                      <FiCheck size={13} /> 0
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dependencies */}
        {deps.length > 0 && (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
              <div className="mb-4.5 flex items-center justify-between gap-3">
                <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Dependencies
                </h2>
                <Link
                  to="/dependencies"
                  className="inline-flex items-center gap-0.75 text-xs text-ink-faint no-underline transition-colors duration-120 hover:text-accent"
                >
                  View all <FiArrowUpRight size={13} />
                </Link>
              </div>
              <div className="mb-5 flex items-baseline gap-1.5">
                <span className="font-display text-[40px] leading-[0.9] font-semibold tracking-[-0.045em] tabular-nums text-ink">
                  {depCounts?.total ?? deps.length}
                </span>
                <span className="text-[13.5px] text-ink-muted">
                  packages declared{depUnused ? ` · ${depUnused} unused` : ''}
                </span>
              </div>
              <div className="flex flex-col gap-3.5">
                {depBreakdown.map((r) => {
                  const total = depCounts?.total || 1;
                  const w = Math.max(r.n ? 4 : 0, (r.n / total) * 100);
                  return (
                    <div key={r.label} className="flex flex-col gap-1.75">
                      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: r.hue }}
                        />
                        {r.label}
                        <b className="ml-auto font-semibold tabular-nums text-ink">{r.n}</b>
                      </div>
                      <div className="h-1.25 overflow-hidden rounded-[5px] bg-surface-2">
                        <span
                          className="block h-full rounded-[5px]"
                          style={{ width: `${w}%`, background: r.hue }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
              <div className="mb-4.5 flex items-center justify-between gap-3">
                <h2 className="m-0 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Most imported
                </h2>
                <span className="text-xs text-ink-faint">packages by files importing them</span>
              </div>
              {topDeps.length > 0 ? (
                <div className="flex flex-col">
                  {topDeps.map((d, i) => (
                    <div
                      key={d.name}
                      className="grid grid-cols-[16px_auto_minmax(0,1fr)_88px_30px] items-center gap-2.75 border-t border-hairline-soft py-2.25 first:border-t-0"
                    >
                      <span className="text-right text-xs tabular-nums text-ink-faint">
                        {i + 1}
                      </span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: DEP_KIND_HUE[d.kind] }}
                      />
                      <span className="min-w-0">
                        {d.npmUrl ? (
                          <a
                            href={d.npmUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-mono tracking-normal no-underline"
                            title={`${d.name} on npm`}
                          >
                            {d.name}
                          </a>
                        ) : (
                          <span
                            className="block truncate font-mono tracking-normal"
                            title={d.name}
                          >
                            {d.name}
                          </span>
                        )}
                      </span>
                      <span className="h-1.25 overflow-hidden rounded-[5px] bg-surface-2">
                        <span
                          className="block h-full rounded-[5px]"
                          style={{
                            width: `${Math.max(6, ((d.usedInCount || 0) / maxDepUse) * 100)}%`,
                            background: DEP_KIND_HUE[d.kind] || 'var(--color-ink-faint)',
                          }}
                        />
                      </span>
                      <span className="text-right text-[13px] font-semibold tabular-nums text-ink">
                        {d.usedInCount || 0}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13.5px] text-ink-faint">
                  No declared packages are imported in the scanned source.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
