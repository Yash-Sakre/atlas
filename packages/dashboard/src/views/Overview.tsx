import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react';
import { useData } from '../data';
import type { Asset } from '../types';
import { EditorLink, PAGE_FOR, TypeBadge, compact, folderName, timeAgo, formatTime } from '../ui';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { InfoTip } from '@/components/ui/info-tip';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentMeter, type Segment } from '@/components/ui/segment-meter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import ReferenceHistogram, { bucketize } from '@/components/charts/ReferenceHistogram';
import ReuseByType, { REUSE_SERIES } from '@/components/charts/ReuseByType';
import { formatBytes } from '../lib/assetFile';
import { cn } from '@/lib/utils';

type Collection = 'components' | 'hooks' | 'utils' | 'contexts' | 'routes';

const COLLECTIONS: Array<{ key: Collection; label: string }> = [
  { key: 'components', label: 'Components' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'utils', label: 'Utils' },
  { key: 'contexts', label: 'Contexts' },
];

type CurveFilter = 'all' | Collection;

export default function Overview() {
  const data = useData();
  const s = data.stats;

  // Every reusable asset (routes are entry points, not reused code).
  const reusable = useMemo<Asset[]>(
    () => COLLECTIONS.flatMap((c) => (data[c.key] as Asset[]) || []),
    [data],
  );

  const reuse = useMemo(() => {
    const reused = reusable.filter((a) => (a.usageCount || 0) >= 2).length;
    const once = reusable.filter((a) => (a.usageCount || 0) === 1).length;
    const total = reusable.length;
    return { reused, once, unused: total - reused - once, total, pct: total ? Math.round((reused / total) * 100) : 0 };
  }, [reusable]);

  // ── Reference spread ──
  const [curve, setCurve] = useState<CurveFilter>('all');
  const counts = useMemo(() => {
    const pool = curve === 'all' ? reusable : ((data[curve] as Asset[]) || []);
    return pool.map((a) => a.usageCount || 0).sort((a, b) => b - a);
  }, [curve, reusable, data]);
  const buckets = useMemo(() => bucketize(counts), [counts]);
  const totalRefs = counts.reduce((a, n) => a + n, 0);
  const referenced = counts.filter((n) => n > 0);
  // Concentration: share of references held by the top 10% of referenced assets.
  const topTenth = Math.max(1, Math.ceil(referenced.length * 0.1));
  const topShare = totalRefs
    ? Math.round((referenced.slice(0, topTenth).reduce((a, n) => a + n, 0) / totalRefs) * 100)
    : 0;

  // ── Reuse by type ──
  const reuseRows = useMemo(
    () =>
      COLLECTIONS.map((c) => {
        const items = (data[c.key] as Asset[]) || [];
        const reused = items.filter((a) => (a.usageCount || 0) >= 2).length;
        const once = items.filter((a) => (a.usageCount || 0) === 1).length;
        return { type: c.label, reused, once, unused: items.length - reused - once };
      }).filter((r) => r.reused + r.once + r.unused > 0),
    [data],
  );

  // ── Health ──
  const dc = data.deadCode || {};
  const deadExports = dc.deadExports?.length || 0;
  const orphans = dc.orphanFiles?.length || 0;
  const dupes = dc.duplicateCandidates?.length || 0;
  const deadTotal = deadExports + orphans + dupes;

  const deps = data.dependencies?.dependencies || [];
  const depCounts = data.dependencies?.counts;
  const depUnused = deps.filter((d) => (d.usedInCount || 0) === 0).length;

  const sa = data.staticAssets?.counts;

  // ── Leaderboards ──
  const topUsed = useMemo(
    () =>
      reusable
        .filter((a) => (a.usageCount || 0) > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 6),
    [reusable],
  );
  const topDeps = useMemo(
    () =>
      [...deps]
        .filter((d) => (d.usedInCount || 0) > 0)
        .sort((a, b) => (b.usedInCount || 0) - (a.usedInCount || 0))
        .slice(0, 6),
    [deps],
  );

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <>
            <span className="font-mono text-ink" title={data.meta.root}>
              {folderName(data.meta.root)}
            </span>
            {' · '}
            {reusable.length} reusable assets across {s.fileCount} files{' · '}
            <span title={formatTime(data.meta.generatedAt)}>analyzed {timeAgo(data.meta.generatedAt)}</span>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {/* ── KPI row ── */}
        <div className="grid grid-cols-4 gap-3 sm:gap-4 max-[1180px]:grid-cols-2">
          <StatCard
            label="Reusable assets"
            value={compact(reusable.length)}
            hint={`${s.components} components · ${s.hooks} hooks`}
            to="/components"
          />
          <StatCard
            label="Reuse rate"
            info="Share of components, hooks, utils and contexts referenced from two or more places."
            value={`${reuse.pct}%`}
            hint={`${reuse.reused} reused 2+ times`}
          />
          <StatCard
            label="Dead code"
            value={deadTotal}
            hint="findings to review"
            to="/dead-code"
            badge={
              deadTotal
                ? { text: 'Review', tone: 'warn', icon: <Warning size={11} weight="fill" /> }
                : { text: 'Clear', tone: 'success', icon: <CheckCircle size={11} weight="fill" /> }
            }
          />
          <StatCard
            label="Dependencies"
            value={depCounts?.total ?? deps.length}
            hint={depCounts ? `${depCounts.prod} prod · ${depCounts.dev} dev` : undefined}
            to="/dependencies"
            badge={
              depUnused
                ? { text: `${depUnused} unused`, tone: 'warn' }
                : deps.length
                  ? { text: 'All used', tone: 'success' }
                  : undefined
            }
          />
        </div>

        {/* ── Reference spread (hero) ── */}
        <Card>
          <CardHeader className="flex-wrap items-start">
            <div className="min-w-0">
              <CardTitle
                info={
                  <InfoTip>
                    How many assets are referenced from how many places. Weight on the left means
                    shallow reuse; bars on the right are the load-bearing assets.
                  </InfoTip>
                }
              >
                Reference spread
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[30px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {totalRefs.toLocaleString()}
                </span>
                <span className="text-[12.5px] text-ink-faint">
                  references across {counts.length} assets
                  {referenced.length > 0 && (
                    <>
                      {' · '}top 10% hold{' '}
                      <b className="font-medium text-ink-muted">{topShare}%</b>
                    </>
                  )}
                </span>
              </div>
            </div>
            <CardAction className="max-w-full overflow-x-auto">
              <Tabs value={curve} onValueChange={(v) => setCurve(v as CurveFilter)}>
                <TabsList aria-label="Filter by asset type">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {COLLECTIONS.map((c) => (
                    <TabsTrigger key={c.key} value={c.key}>
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-4">
            {counts.length > 0 ? (
              <>
                <ReferenceHistogram key={curve} data={buckets} />
                <p className="m-0 mt-2 text-center text-[11.5px] text-ink-faint">
                  Assets grouped by how many places reference them
                </p>
              </>
            ) : (
              <EmptyState title="No assets of this type">
                Nothing of this kind was found in the scanned source.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        {/* ── Health + Reuse by type ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Codebase health</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs defaultValue="dead">
                <TabsList variant="underline">
                  <TabsTrigger value="dead">Dead code</TabsTrigger>
                  <TabsTrigger value="deps">Dependencies</TabsTrigger>
                  <TabsTrigger value="assets">Static assets</TabsTrigger>
                </TabsList>
                <TabsContent value="dead" className="outline-none">
                  <HealthPanel
                    to="/dead-code"
                    segments={[
                      { key: 'exports', label: 'Unused exports', value: deadExports, color: 'var(--color-chart-1)' },
                      { key: 'orphans', label: 'Orphan files', value: orphans, color: 'var(--color-chart-2)' },
                      { key: 'dupes', label: 'Duplicates', value: dupes, color: 'var(--color-chart-3)' },
                    ]}
                    unit="found"
                  />
                </TabsContent>
                <TabsContent value="deps" className="outline-none">
                  <HealthPanel
                    to="/dependencies"
                    segments={[
                      { key: 'prod', label: 'Production', value: depCounts?.prod || 0, color: 'var(--color-chart-1)' },
                      { key: 'dev', label: 'Development', value: depCounts?.dev || 0, color: 'var(--color-chart-2)' },
                      {
                        key: 'peer',
                        label: 'Peer & optional',
                        value: (depCounts?.peer || 0) + (depCounts?.optional || 0),
                        color: 'var(--color-chart-3)',
                      },
                      { key: 'unused', label: 'Never imported', value: depUnused, color: 'var(--color-surface-3)', excluded: true },
                    ]}
                    unit="packages"
                  />
                </TabsContent>
                <TabsContent value="assets" className="outline-none">
                  <HealthPanel
                    to="/assets"
                    segments={[
                      {
                        key: 'images',
                        label: 'Images & vectors',
                        value: (sa?.byKind.image || 0) + (sa?.byKind.vector || 0),
                        color: 'var(--color-chart-1)',
                      },
                      { key: 'fonts', label: 'Fonts', value: sa?.byKind.font || 0, color: 'var(--color-chart-2)' },
                      {
                        key: 'media',
                        label: 'Media & docs',
                        value: (sa?.byKind.video || 0) + (sa?.byKind.audio || 0) + (sa?.byKind.document || 0),
                        color: 'var(--color-chart-3)',
                      },
                      { key: 'unused', label: 'Unreferenced', value: sa?.unused || 0, color: 'var(--color-surface-3)', excluded: true },
                    ]}
                    unit={sa ? `files · ${formatBytes(sa.totalBytes)}` : 'files'}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="items-start">
              <div>
                <CardTitle>Reuse by type</CardTitle>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[30px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                    {reuse.pct}%
                  </span>
                  <span className="text-[12.5px] text-ink-faint">reused in 2+ places</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-ink-muted">
                {REUSE_SERIES.map((r) => (
                  <li key={r.key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs" style={{ background: r.color }} />
                    {r.label}
                    <span className="text-ink-faint tabular-nums">{reuse[r.key]}</span>
                  </li>
                ))}
              </ul>
              {reuseRows.length ? (
                <ReuseByType data={reuseRows} />
              ) : (
                <EmptyState title="No reusable assets found" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Leaderboards ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most referenced</CardTitle>
              <CardAction>
                <span className="text-[12px] text-ink-faint">{data.graph?.edges?.length || 0} links</span>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-2">
              {topUsed.length ? (
                <Leaderboard
                  rows={topUsed.map((a) => ({
                    key: a.id,
                    value: a.usageCount || 0,
                    lead: <TypeBadge type={a.type} />,
                    name: (
                      <Link
                        to={`${PAGE_FOR[a.type] || '/'}?focus=${encodeURIComponent(a.id)}`}
                        className="truncate font-mono text-[12.5px] text-ink no-underline hover:underline"
                        title={a.path}
                      >
                        {a.name}
                      </Link>
                    ),
                    trail: (
                      <EditorLink
                        root={data.meta.root}
                        path={a.location?.filePath || a.path}
                        line={a.location?.line}
                        column={a.location?.column}
                        iconOnly
                      />
                    ),
                  }))}
                />
              ) : (
                <EmptyState title="No references detected yet" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Most imported packages</CardTitle>
              <CardAction>
                <Link
                  to="/dependencies"
                  className="inline-flex items-center gap-1 text-[12px] text-ink-faint no-underline transition-colors hover:text-ink"
                >
                  View all <ArrowRight size={12} />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-2">
              {topDeps.length ? (
                <Leaderboard
                  rows={topDeps.map((d) => ({
                    key: d.name,
                    value: d.usedInCount || 0,
                    lead: <span className="w-9 text-[11px] text-ink-faint">{d.kind}</span>,
                    name: d.npmUrl ? (
                      <a
                        href={d.npmUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-[12.5px] text-ink no-underline hover:underline"
                        title={`${d.name} on npm`}
                      >
                        {d.name}
                      </a>
                    ) : (
                      <span className="truncate font-mono text-[12.5px] text-ink">{d.name}</span>
                    ),
                  }))}
                />
              ) : (
                <EmptyState title="No declared packages are imported" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

/**
 * One health tab: a proportional meter over its segments, then a labelled tile
 * per segment (label, dot and count — identity never rests on the meter's
 * color). `excluded` segments are callouts shown as tiles but kept out of the
 * meter, since they overlap the others.
 */
function HealthPanel({
  segments,
  unit,
  to,
}: {
  segments: Array<Segment & { excluded?: boolean }>;
  unit: string;
  to: string;
}) {
  const inMeter = segments.filter((x) => !x.excluded);
  const total = inMeter.reduce((a, x) => a + x.value, 0);
  return (
    <div className="pt-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[22px] leading-none font-semibold tabular-nums">{total}</span>
        <span className="text-[12.5px] text-ink-faint">{unit}</span>
      </div>
      <SegmentMeter segments={inMeter} />
      <div className={cn('mt-4 grid gap-2.5', segments.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {segments.map((x, i) => (
          <motion.div
            key={x.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Link
              to={to}
              className="block rounded-lg px-3.5 py-3 no-underline shadow-[inset_0_0_0_1px_var(--color-hairline-soft)] transition-colors hover:bg-surface-2/60 focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none"
            >
              <span
                className="mb-2.5 block h-1 w-6 rounded-full"
                style={{ background: x.excluded ? 'var(--color-warn)' : x.color }}
                aria-hidden="true"
              />
              <span className="block text-[12px] text-ink-muted">{x.label}</span>
              <span className="mt-1 block text-[20px] leading-none font-semibold text-ink tabular-nums">
                {x.value}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface LeaderRow {
  key: string;
  value: number;
  lead: React.ReactNode;
  name: React.ReactNode;
  trail?: React.ReactNode;
}

/** Ranked rows with an inline magnitude bar scaled to the leader. */
function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  const max = rows[0]?.value || 1;
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => (
        <li
          key={r.key}
          className="grid grid-cols-[14px_auto_minmax(0,1fr)_minmax(48px,96px)_28px_16px] items-center gap-3 border-t border-hairline-soft py-2.5 first:border-t-0"
        >
          <span className="text-right text-[11.5px] text-ink-faint tabular-nums">{i + 1}</span>
          {r.lead}
          <span className="flex min-w-0">{r.name}</span>
          <span className="h-1 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(6, (r.value / max) * 100)}%` }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="block h-full rounded-full bg-chart-2"
            />
          </span>
          <span className="text-right text-[12.5px] font-medium text-ink tabular-nums">{r.value}</span>
          <span className="flex justify-end">{r.trail}</span>
        </li>
      ))}
    </ol>
  );
}
