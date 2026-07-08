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
import { SearchField, useFuzzy } from '../ui';
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
  dev: 'var(--ink-faint)',
  peer: '#ffce85',
  optional: '#c0a8ff',
};

const KIND_ORDER: DependencyKind[] = ['prod', 'dev', 'peer', 'optional'];

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
  const fuzzy = useFuzzy(deps, ['name']);

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
    let base = fuzzy(query);
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
        <div className="atlas-panel atlas-deadclear">
          <FiPackage size={26} style={{ color: 'var(--ink-faint)' }} />
          <div>
            <h2 className="atlas-section-title" style={{ marginBottom: 4 }}>No dependencies found</h2>
            <p className="atlas-faint">
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
    { label: 'Total', n: c.total, hue: 'var(--t-component)' },
    { label: 'Production', n: c.prod, hue: KIND_COLOR.prod },
    { label: 'Dev', n: c.dev, hue: 'var(--ink-faint)' },
    { label: 'Updates', n: outdatedSet.size, hue: 'var(--warn)' },
    { label: 'Unused', n: unused, hue: 'var(--warn)' },
  ];

  return (
    <>
      <Head total={c.total} outdated={outdatedSet.size} />

      <div className="atlas-kpis" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="atlas-kpi" style={{ cursor: 'default' }}>
            <div className="atlas-kpi-top">
              <span className="atlas-kpi-dot" style={{ background: k.hue }} />
              <span className="atlas-kpi-label">{k.label}</span>
            </div>
            <div className="atlas-kpi-num">{k.n}</div>
          </div>
        ))}
      </div>

      <section className="atlas-panel atlas-deadsection atlas-deadsection--fill">
        <div className="atlas-deadfilters">
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
          <div className="atlas-empty">
            <FiInbox size={24} strokeWidth={1.6} />
            <p>No dependencies match your filters.</p>
          </div>
        ) : (
          <div className="atlas-table-wrap">
            <table className="atlas-table atlas-deptable">
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
        <div className="atlas-dep-name">
          {isRegistry && dep.npmUrl ? (
            <a
              href={dep.npmUrl}
              target="_blank"
              rel="noreferrer"
              className="atlas-editorlink mono"
              title={`${dep.name} on npm`}
            >
              {dep.name}
              <FiExternalLink className="atlas-editorlink-glyph" aria-hidden="true" />
            </a>
          ) : (
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 500 }}>{dep.name}</span>
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
          <p className="atlas-dep-desc atlas-faint atlas-trunc" title={meta.description}>
            {meta.description}
          </p>
        )}
      </td>
      <td>
        <Badge withDot style={{ color: KIND_COLOR[dep.kind] }}>{KIND_LABEL[dep.kind]}</Badge>
      </td>
      <td className="mono atlas-faint">{dep.range}</td>
      <td className="mono">{dep.installed || <span className="atlas-faint">—</span>}</td>
      <td>
        {!isRegistry ? (
          <span className="atlas-faint mono" title={`Linked from a ${source} source`}>—</span>
        ) : status === 'loading' ? (
          <span className="atlas-faint mono">…</span>
        ) : status === 'error' ? (
          <span className="atlas-faint mono" title="Couldn’t reach the npm registry">n/a</span>
        ) : outdated ? (
          <span className="atlas-dep-update" title={`Newer version available: ${meta?.latest}`}>
            <FiArrowUp size={12} />
            <span className="mono">{meta?.latest}</span>
          </span>
        ) : (
          <span className="atlas-dep-latest mono" title="Up to date">
            <FiCheck size={12} /> {meta?.latest}
          </span>
        )}
      </td>
      <td>
        {dep.usedInCount > 0 ? (
          <span className="tnum" title={`Imported in ${dep.usedInCount} file(s)`}>{dep.usedInCount}</span>
        ) : (
          <span className="atlas-pill" style={{ color: 'var(--warn)' }} title="Declared but never imported">
            <span className="atlas-dot" style={{ background: 'currentColor' }} />
            unused
          </span>
        )}
      </td>
      <td>
        {isRegistry ? (
          <div className="atlas-dep-links">
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
          <span className="atlas-faint">—</span>
        )}
      </td>
    </tr>
  );
}

function Head({ total, outdated }: { total: number; outdated: number }) {
  return (
    <div className="atlas-pagehead">
      <div className="atlas-pagehead-main">
        <h1 className="atlas-pagehead-title">Dependencies</h1>
        <p className="atlas-pagehead-sub">
          Third-party packages declared in package.json — enriched live from the npm registry.
          Click a name to open it on npm.
        </p>
      </div>
      <div className="atlas-pagehead-side">
        <span
          className="atlas-pill"
          style={{ color: outdated ? 'var(--warn)' : 'var(--success)' }}
        >
          <span className="atlas-dot" style={{ background: 'currentColor' }} />
          {total ? (outdated ? `${outdated} update${outdated > 1 ? 's' : ''} available` : 'All up to date') : 'None'}
        </span>
      </div>
    </div>
  );
}
