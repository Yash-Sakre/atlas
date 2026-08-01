import { useMemo, useState } from 'react';
import {
  FiPackage,
  FiExternalLink,
  FiGithub,
  FiHome,
  FiArrowUp,
  FiCheck,
  FiInbox,
} from 'react-icons/fi';
import { FaNpm } from 'react-icons/fa';
import { useData } from '../data';
import type { DependencyInfo, DependencyKind } from '../types';
import { SearchField, useSearch } from '../ui';
import { useNpmRegistry, isOutdated, sourceOf, SOURCE_LABEL, type NpmMeta } from '../lib/npm';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const KIND_LABEL: Record<DependencyKind, string> = {
  prod: 'prod',
  dev: 'dev',
  peer: 'peer',
  optional: 'optional',
};

const KIND_COLOR: Record<DependencyKind, string> = {
  prod: '#7be3a8',
  dev: 'var(--color-ink-faint)',
  peer: '#ffce85',
  optional: '#c0a8ff',
};

const KIND_ORDER: DependencyKind[] = ['prod', 'dev', 'peer', 'optional'];

/** Table chrome: hairline rules, sticky headers, top-aligned cells. */
const TABLE_CLASS =
  'w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-hairline-soft [&_td]:py-2.25 [&_td]:pr-4 [&_td]:align-top [&_td]:text-ink-muted [&_td:first-child]:min-w-[200px] [&_td:first-child]:text-ink [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:border-b [&_th]:border-hairline-soft [&_th]:bg-surface-1 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12.5px] [&_th]:font-medium [&_th]:text-ink-muted [&_tr:last-child_td]:border-b-0';

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
  const search = useSearch(deps, ['name']);

  const current = (d: DependencyInfo) => d.installed || d.range;
  const outdatedSet = useMemo(() => {
    const s = new Set<string>();
    for (const d of deps) {
      if (isOutdated(current(d), npm[d.name]?.latest)) s.add(d.name);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, npm]);

  const kindsPresent = useMemo(
    () => KIND_ORDER.filter((k) => deps.some((d) => d.kind === k)),
    [deps],
  );

  const rows = useMemo(() => {
    let base = search(query);
    if (kindFilter.length) base = base.filter((d) => kindFilter.includes(d.kind));
    if (flags.includes('outdated')) base = base.filter((d) => outdatedSet.has(d.name));
    if (flags.includes('unused')) base = base.filter((d) => d.usedInCount === 0);
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kindFilter, flags, deps, outdatedSet]);

  if (!report || deps.length === 0) {
    return (
      <>
        <Head total={0} outdated={0} />
        <div className="flex items-center gap-4 rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
          <FiPackage size={26} className="text-ink-faint" />
          <div>
            <h2 className="m-0 mb-1 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              No dependencies found
            </h2>
            <p className="text-ink-faint">
              Atlas didn’t find a package.json with declared dependencies at the project root.
            </p>
          </div>
        </div>
      </>
    );
  }

  const c = report.counts;
  const unused = deps.filter((d) => d.usedInCount === 0).length;
  const kpis: Array<{ label: string; n: number; hue: string }> = [
    { label: 'Total', n: c.total, hue: 'var(--color-t-component)' },
    { label: 'Production', n: c.prod, hue: KIND_COLOR.prod },
    { label: 'Dev', n: c.dev, hue: 'var(--color-ink-faint)' },
    { label: 'Updates', n: outdatedSet.size, hue: 'var(--color-warn)' },
    { label: 'Unused', n: unused, hue: 'var(--color-warn)' },
  ];

  return (
    <>
      <Head total={c.total} outdated={outdatedSet.size} />

      <div className="mb-4 grid grid-cols-5 gap-4 max-[1180px]:grid-cols-3 max-[620px]:grid-cols-2">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative flex cursor-default flex-col gap-3 rounded-2xl bg-surface-1 px-4.5 pt-4.5 pb-4.25 shadow-card"
          >
            <div className="flex items-center gap-1.75">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: k.hue }} />
              <span className="text-[12.5px] tracking-[-0.01em] text-ink-muted">{k.label}</span>
            </div>
            <div className="font-display text-[34px] leading-[0.9] font-semibold tracking-[-0.04em] tabular-nums text-ink">
              {k.n}
            </div>
          </div>
        ))}
      </div>

      <section className="flex min-h-0 flex-auto flex-col rounded-2xl bg-surface-1 px-6 py-5.5 shadow-card">
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search dependencies…" />
          {kindsPresent.length > 1 && (
            <ToggleGroup
              type="multiple"
              value={kindFilter}
              onValueChange={setKindFilter}
              className="flex flex-wrap gap-1.5"
            >
              {kindsPresent.map((k) => (
                <ToggleGroupItem key={k} value={k} title={`Show only ${k} dependencies`}>
                  {KIND_LABEL[k]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup
            type="multiple"
            value={flags}
            onValueChange={setFlags}
            className="flex flex-wrap gap-1.5"
          >
            <ToggleGroupItem value="outdated" title="Only packages with a newer version">
              updates
            </ToggleGroupItem>
            <ToggleGroupItem value="unused" title="Declared but never imported">
              unused
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13.5px] text-ink-faint">
            <FiInbox size={24} strokeWidth={1.6} />
            <p>No dependencies match your filters.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-auto overflow-x-auto overflow-y-auto overscroll-contain max-[900px]:overflow-y-visible">
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Kind</th>
                  <th>Declared</th>
                  <th>Installed</th>
                  <th>Latest</th>
                  <th>Used in</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <Row key={d.name} dep={d} meta={npm[d.name]} outdated={outdatedSet.has(d.name)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ dep, meta, outdated }: { dep: DependencyInfo; meta?: NpmMeta; outdated: boolean }) {
  const source = sourceOf(dep);
  const isRegistry = source === 'registry';
  const status = meta?.status ?? 'loading';
  return (
    <tr>
      <td>
        <div className="flex min-w-0 items-center gap-2">
          {isRegistry && dep.npmUrl ? (
            <a
              href={dep.npmUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full min-w-0 items-center gap-1.25 rounded-sm font-mono text-[13.5px] font-medium tracking-normal text-inherit no-underline transition-colors duration-120 hover:text-accent"
              title={`${dep.name} on npm`}
            >
              {dep.name}
              <FiExternalLink
                className="h-3 w-3 shrink-0 text-accent opacity-0 transition-opacity duration-120 group-hover:opacity-100"
                aria-hidden="true"
              />
            </a>
          ) : (
            <span className="font-mono font-medium tracking-normal text-ink">{dep.name}</span>
          )}
          {!isRegistry && (
            <Badge variant="tag" title={`Resolved from a ${source} source, not the npm registry`}>
              {SOURCE_LABEL[source]}
            </Badge>
          )}
          {dep.workspace && (
            <Badge variant="tag" title={`Declared in ${dep.workspace}`}>{dep.workspace}</Badge>
          )}
        </div>
        {isRegistry && status === 'ok' && meta?.description && (
          <p className="mt-0.75 mb-0 max-w-[460px] truncate text-xs text-ink-faint" title={meta.description}>
            {meta.description}
          </p>
        )}
      </td>
      <td>
        <Badge withDot style={{ color: KIND_COLOR[dep.kind] }}>{KIND_LABEL[dep.kind]}</Badge>
      </td>
      <td className="font-mono tracking-normal text-ink-faint">{dep.range}</td>
      <td className="font-mono tracking-normal">
        {dep.installed || <span className="text-ink-faint">—</span>}
      </td>
      <td>
        {!isRegistry ? (
          <span className="font-mono tracking-normal text-ink-faint" title={`Linked from a ${source} source`}>
            —
          </span>
        ) : status === 'loading' ? (
          <span className="font-mono tracking-normal text-ink-faint">…</span>
        ) : status === 'error' ? (
          <span
            className="font-mono tracking-normal text-ink-faint"
            title="Couldn’t reach the npm registry"
          >
            n/a
          </span>
        ) : outdated ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[12.5px] text-warn"
            title={`Newer version available: ${meta?.latest}`}
          >
            <FiArrowUp size={12} />
            <span className="font-mono tracking-normal">{meta?.latest}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 font-mono text-[12.5px] tracking-normal text-success"
            title="Up to date"
          >
            <FiCheck size={12} /> {meta?.latest}
          </span>
        )}
      </td>
      <td>
        {dep.usedInCount > 0 ? (
          <span className="tabular-nums" title={`Imported in ${dep.usedInCount} file(s)`}>
            {dep.usedInCount}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium text-warn"
            title="Declared but never imported"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            unused
          </span>
        )}
      </td>
      <td>
        {isRegistry ? (
          <div className="inline-flex items-center gap-2.5 text-ink-faint [&_a]:inline-flex [&_a]:text-inherit [&_a]:transition-colors [&_a:hover]:text-accent">
            {dep.npmUrl && (
              <a href={dep.npmUrl} target="_blank" rel="noreferrer" title="View on npm" aria-label="View on npm">
                <FaNpm size={19} />
              </a>
            )}
            {meta?.homepage && (
              <a href={meta.homepage} target="_blank" rel="noreferrer" title="Homepage" aria-label="Homepage">
                <FiHome size={15} />
              </a>
            )}
            {meta?.repoUrl && (
              <a href={meta.repoUrl} target="_blank" rel="noreferrer" title="Repository" aria-label="Repository">
                <FiGithub size={15} />
              </a>
            )}
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
    </tr>
  );
}

function Head({ total, outdated }: { total: number; outdated: number }) {
  return (
    <div className="mb-5.5 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-soft pb-4.5">
      <div className="min-w-0">
        <h1 className="m-0 font-display text-2xl leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
          Dependencies
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          Third-party packages declared in package.json — enriched live from the npm registry.
          Click a name to open it on npm.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.75 py-1 text-xs font-medium ${
            outdated ? 'text-warn' : 'text-success'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {total ? (outdated ? `${outdated} update${outdated > 1 ? 's' : ''} available` : 'All up to date') : 'None'}
        </span>
      </div>
    </div>
  );
}
