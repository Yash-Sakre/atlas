/**
 * Declared dependencies, enriched live from the npm registry.
 *
 * The analyzer records only what package.json declares (offline). Latest
 * version, description and links are fetched lazily in the browser — and only
 * for registry packages: local/git/workspace links have no npm page to check.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  CaretDown,
  CaretUp,
  CaretUpDown,
  CheckCircle,
  CircleNotch,
  FunnelSimple,
  GitBranch,
  GithubLogo,
  House,
  Package,
  Warning,
} from '@phosphor-icons/react';
import { useData } from '../data';
import type { DependencyInfo, DependencyKind, DependencySource } from '../types';
import { FilterCount, SearchField, TABLE_CLASS, useSearch } from '../ui';
import { useNpmRegistry, isOutdated, sourceOf, SOURCE_LABEL, type NpmMeta } from '../lib/npm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<DependencyKind, string> = {
  prod: 'prod',
  dev: 'dev',
  peer: 'peer',
  optional: 'optional',
};

/** Identity dot per kind — always beside the kind's name, never alone. */
const KIND_HUE: Record<DependencyKind, string> = {
  prod: 'var(--color-chart-1)',
  dev: 'var(--color-chart-3)',
  peer: 'var(--color-t-context)',
  optional: 'var(--color-t-hook)',
};

const KIND_ORDER: DependencyKind[] = ['prod', 'dev', 'peer', 'optional'];

type SortKey = 'name' | 'used';
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null;

const SEARCH_KEYS = ['name'];

const current = (d: DependencyInfo) => d.installed || d.range;

export default function Dependencies() {
  const data = useData();
  const report = data.dependencies;
  const deps = useMemo<DependencyInfo[]>(() => report?.dependencies || [], [report]);

  // Only registry packages get enriched from npm — local/git/workspace links
  // have no npm page, latest version, or update to check.
  const registryNames = useMemo(
    () => deps.filter((d) => sourceOf(d) === 'registry').map((d) => d.name),
    [deps],
  );
  const npm = useNpmRegistry(registryNames);

  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const search = useSearch(deps, SEARCH_KEYS);

  // `npm` is a fresh object each render; only the resolved versions matter here.
  const latestKey = registryNames.map((n) => npm[n]?.latest ?? '').join(',');
  const outdatedSet = useMemo(() => {
    const s = new Set<string>();
    for (const d of deps) {
      if (isOutdated(current(d), npm[d.name]?.latest)) s.add(d.name);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, latestKey]);

  const checking = registryNames.filter((n) => npm[n]?.status === 'loading').length;

  const kindsPresent = useMemo(
    () => KIND_ORDER.filter((k) => deps.some((d) => d.kind === k)),
    [deps],
  );

  const rows = useMemo(() => {
    let base = search(query);
    if (kindFilter.length) base = base.filter((d) => kindFilter.includes(d.kind));
    if (flags.includes('outdated')) base = base.filter((d) => outdatedSet.has(d.name));
    if (flags.includes('unused')) base = base.filter((d) => d.usedInCount === 0);
    if (sort) {
      const sign = sort.dir === 'asc' ? 1 : -1;
      base.sort((a, b) =>
        sort.key === 'name'
          ? sign * a.name.localeCompare(b.name)
          : sign * ((a.usedInCount || 0) - (b.usedInCount || 0)) || a.name.localeCompare(b.name),
      );
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kindFilter, flags, sort, deps, outdatedSet]);

  const filtered = !!query || kindFilter.length > 0 || flags.length > 0;
  const clearFilters = () => {
    setQuery('');
    setKindFilter([]);
    setFlags([]);
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );

  if (!report || deps.length === 0) {
    return (
      <>
        <PageHeader title="Dependencies" description="Packages declared in package.json." />
        <Card>
          <EmptyState icon={<Package size={20} />} title="No dependencies found">
            Atlas didn’t find a package.json with declared dependencies at the project root.
          </EmptyState>
        </Card>
      </>
    );
  }

  const c = report.counts;
  const unused = deps.filter((d) => d.usedInCount === 0).length;
  const nonRegistry = deps.filter((d) => sourceOf(d) !== 'registry');
  const bySource = new Map<DependencySource, number>();
  for (const d of nonRegistry) bySource.set(sourceOf(d), (bySource.get(sourceOf(d)) || 0) + 1);
  const sourceHint = nonRegistry.length
    ? [...bySource].map(([s, n]) => `${n} ${SOURCE_LABEL[s]}`).join(' · ')
    : 'all from npm';

  const updates = outdatedSet.size;
  const status = updates ? (
    <Badge variant="warn">
      <ArrowUp size={11} weight="bold" />
      {updates} update{updates === 1 ? '' : 's'} available
    </Badge>
  ) : checking ? (
    <Badge>
      <CircleNotch size={11} weight="bold" className="animate-spin" />
      Checking npm…
    </Badge>
  ) : (
    <Badge variant="success">
      <CheckCircle size={11} weight="fill" />
      All up to date
    </Badge>
  );

  return (
    <>
      <PageHeader
        title="Dependencies"
        description="Packages declared in package.json, enriched live from the npm registry. Click a name to open it on npm."
        actions={status}
      />

      <div className="mb-4 grid shrink-0 grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard
          label="Total"
          value={c.total}
          hint={`${c.prod} prod · ${c.dev} dev`}
          info="Every dependency declared across package.json files, including peer and optional."
        />
        <StatCard
          label="Updates available"
          value={updates}
          hint={checking ? `checking ${checking} on npm…` : `of ${registryNames.length} on npm`}
          info="Registry packages whose latest published version is newer than the installed (or declared) one."
          badge={
            checking
              ? undefined
              : updates
                ? { text: 'Update', tone: 'warn', icon: <ArrowUp size={11} weight="bold" /> }
                : { text: 'Current', tone: 'success', icon: <CheckCircle size={11} weight="fill" /> }
          }
        />
        <StatCard
          label="Unused"
          value={unused}
          hint="declared, never imported"
          info="No source file imports this package by its bare name. CLI tools and config plugins often show up here legitimately."
          badge={
            unused
              ? { text: 'Review', tone: 'warn', icon: <Warning size={11} weight="fill" /> }
              : { text: 'All used', tone: 'success', icon: <CheckCircle size={11} weight="fill" /> }
          }
        />
        <StatCard
          label="Non-registry"
          value={nonRegistry.length}
          hint={sourceHint}
          info="Resolved from a local path, git, a URL or the workspace protocol — no npm page or update check."
        />
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden max-[900px]:overflow-visible">
        <CardHeader className="flex-wrap justify-start gap-x-3 gap-y-2.5 pb-3.5">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search dependencies…"
            className="max-w-xs min-w-48"
          />
          {kindsPresent.length > 1 && (
            <ToggleGroup type="multiple" value={kindFilter} onValueChange={setKindFilter} aria-label="Filter by kind">
              {kindsPresent.map((k) => (
                <ToggleGroupItem key={k} value={k} title={`Show only ${k} dependencies`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_HUE[k] }} aria-hidden="true" />
                  {KIND_LABEL[k]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup type="multiple" value={flags} onValueChange={setFlags} aria-label="Filter by status">
            <ToggleGroupItem value="outdated" title="Only packages with a newer version">
              <ArrowUp size={12} />
              Updates
            </ToggleGroupItem>
            <ToggleGroupItem value="unused" title="Declared but never imported">
              <Warning size={12} />
              Unused
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="ml-auto">
            <FilterCount shown={rows.length} total={deps.length} />
          </span>
        </CardHeader>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FunnelSimple size={20} />}
            title="No dependencies match your filters"
            action={
              filtered && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain max-[900px]:overflow-y-visible">
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <SortHeader label="Package" active={sort?.key === 'name' ? sort.dir : null} onSort={() => toggleSort('name')} />
                  <th>Kind</th>
                  <th>Declared</th>
                  <th>Installed</th>
                  <th>Latest</th>
                  <SortHeader label="Used in" active={sort?.key === 'used' ? sort.dir : null} onSort={() => toggleSort('used')} />
                  <th>
                    <span className="sr-only">Links</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <Row key={`${d.workspace ?? ''}:${d.name}`} dep={d} meta={npm[d.name]} outdated={outdatedSet.has(d.name)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

function SortHeader({
  label,
  active,
  onSort,
}: {
  label: string;
  active: 'asc' | 'desc' | null;
  onSort: () => void;
}) {
  const Caret = active === 'asc' ? CaretUp : active === 'desc' ? CaretDown : CaretUpDown;
  return (
    <th aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          '-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-xs px-1 py-0.5 transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none',
          active && 'text-ink-muted',
        )}
      >
        {label}
        <Caret size={11} weight="bold" className={active ? 'text-ink' : 'opacity-60'} aria-hidden="true" />
      </button>
    </th>
  );
}

function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Tooltip content={label}>
      <Button asChild variant="ghost" size="icon-sm">
        <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
          {children}
        </a>
      </Button>
    </Tooltip>
  );
}

const Dash = ({ title }: { title?: string }) => (
  <span className="font-mono text-ink-faint" title={title}>
    —
  </span>
);

function Row({ dep, meta, outdated }: { dep: DependencyInfo; meta?: NpmMeta; outdated: boolean }) {
  const source = sourceOf(dep);
  const isRegistry = source === 'registry';
  const status = meta?.status ?? 'loading';
  const isGithub = !!meta?.repoUrl && /github\.com/.test(meta.repoUrl);

  return (
    <tr>
      <td className="min-w-55">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {isRegistry && dep.npmUrl ? (
            <a
              href={dep.npmUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate rounded-xs font-mono text-[13px] font-medium text-ink no-underline hover:underline focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none"
              title={`${dep.name} on npm`}
            >
              {dep.name}
            </a>
          ) : (
            <span className="truncate font-mono text-[13px] font-medium text-ink">{dep.name}</span>
          )}
          {!isRegistry && (
            <Badge variant="tag" title={`Resolved from a ${source} source, not the npm registry`}>
              {SOURCE_LABEL[source]}
            </Badge>
          )}
          {dep.workspace && (
            <Badge variant="tag" title={`Declared in ${dep.workspace}`}>
              {dep.workspace}
            </Badge>
          )}
        </div>
        {isRegistry && status === 'ok' && meta?.description && (
          <p className="mt-0.5 mb-0 max-w-100 truncate text-[12px] text-ink-faint" title={meta.description}>
            {meta.description}
          </p>
        )}
      </td>
      <td>
        <Badge dot={KIND_HUE[dep.kind]}>{KIND_LABEL[dep.kind]}</Badge>
      </td>
      <td className="font-mono text-[12.5px] whitespace-nowrap text-ink-faint">{dep.range}</td>
      <td className="font-mono text-[12.5px] whitespace-nowrap">{dep.installed || <Dash title="Not installed" />}</td>
      <td className="whitespace-nowrap">
        {!isRegistry ? (
          <Dash title={`Linked from a ${source} source`} />
        ) : status === 'loading' ? (
          <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-surface-2 align-middle" aria-label="Checking npm" />
        ) : status === 'error' ? (
          <span className="font-mono text-[12.5px] text-ink-faint" title="Couldn’t reach the npm registry">
            n/a
          </span>
        ) : outdated ? (
          <Badge variant="warn" title={`Newer version available: ${meta?.latest}`}>
            <ArrowUp size={11} weight="bold" />
            <span className="font-mono">{meta?.latest}</span>
          </Badge>
        ) : (
          <Badge variant="success" title="Up to date">
            <CheckCircle size={11} weight="fill" />
            <span className="font-mono">{meta?.latest}</span>
          </Badge>
        )}
      </td>
      <td className="tabular-nums">
        {dep.usedInCount > 0 ? (
          <span title={`Imported in ${dep.usedInCount} file${dep.usedInCount === 1 ? '' : 's'}`}>
            {dep.usedInCount} file{dep.usedInCount === 1 ? '' : 's'}
          </span>
        ) : (
          <Badge variant="warn" title="Declared but never imported">
            <Warning size={11} weight="fill" />
            Unused
          </Badge>
        )}
      </td>
      <td>
        {isRegistry ? (
          <div className="-my-1 inline-flex items-center gap-0.5 text-ink-faint">
            {dep.npmUrl && (
              <IconLink href={dep.npmUrl} label="View on npm">
                <Package size={15} />
              </IconLink>
            )}
            {meta?.homepage && (
              <IconLink href={meta.homepage} label="Homepage">
                <House size={15} />
              </IconLink>
            )}
            {meta?.repoUrl && (
              <IconLink href={meta.repoUrl} label="Repository">
                {isGithub ? <GithubLogo size={15} /> : <GitBranch size={15} />}
              </IconLink>
            )}
          </div>
        ) : (
          <Dash />
        )}
      </td>
    </tr>
  );
}
