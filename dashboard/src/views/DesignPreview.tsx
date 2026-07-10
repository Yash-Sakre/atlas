/**
 * Design preview — a static product-UI template painted entirely with the
 * design tokens Atlas extracted from the analyzed codebase, rendered once per
 * discovered theme (default/dark/…) so the palettes can be compared live.
 *
 * Token→role mapping is heuristic: for each visual role (background, surface,
 * text, primary, …) we take the first matching token by name, falling back to
 * neutral derived values so the template still looks coherent for projects
 * with sparse tokens. The mapping used is shown under each frame.
 */
import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiBell,
  FiDroplet,
  FiMoon,
  FiPlus,
  FiSearch,
  FiSun,
} from 'react-icons/fi';
import { useData } from '../data';
import type { DesignSystemReport, ThemeInfo } from '../types';
import { Button } from '@/components/ui/button';
import { buildResolved, findTokenEntry, lightnessOf, paintable } from '../lib/tokens';

/* ---------------------------- Role derivation ----------------------------- */

interface Roles {
  vars: CSSProperties;
  isDark: boolean;
  /** role → token name it was mapped from (for the caption under the frame). */
  mapping: Array<[string, string]>;
}

type Found = { name: string; value: string } | undefined;

function deriveRoles(ds: DesignSystemReport, themeName: string): Roles {
  const resolved = buildResolved(ds.tokens, themeName);
  // Only color-category tokens participate in color roles.
  const colorNames = new Set(
    ds.tokens.filter((t) => t.category === 'color').map((t) => t.name),
  );
  const colors = new Map([...resolved].filter(([n]) => colorNames.has(n)));

  const pick = (patterns: RegExp[]): Found => findTokenEntry(colors, patterns);

  const bg = pick([/^--(background|bg|canvas|body-bg|app-bg)$/, /^--(page|body|app)-(background|bg)/]);
  const surface = pick([
    /^--(card|surface|panel)$/,
    /^--card-(background|bg)(-color)?$/,
    /^--(surface|panel)-?1?$/,
    /card.*(bg|background)/,
  ]);
  const text = pick([/^--(foreground|ink|text)$/, /^--(body-)?text-color$/, /^--text-primary/]);
  const muted = pick([/^--muted-foreground$/, /^--(ink|text)-muted$/, /muted-foreground/, /secondary-text/]);
  const border = pick([/^--(border|border-color|hairline|divider)$/, /border-color/, /hairline/]);
  const primary = pick([
    /^--(primary|brand)$/,
    /^--(primary|brand)-(500|600)$/,
    /^--info$/,
    /^--accent$/,
    /^--active-button-color$/,
  ]);
  const primaryFg = pick([/^--(primary|accent|brand)-foreground$/]);
  // For semantic colors, skip -foreground/-bg companions (text-on-color, tints).
  const notCompanion = '(?!.*(foreground|-fg|-bg|background|soft|muted))';
  const success = pick([
    /^--(success|green)$/,
    new RegExp(`success${notCompanion}`),
    new RegExp(`(^|-)green${notCompanion}`),
  ]);
  const warn = pick([
    /^--(warn|warning|amber)$/,
    new RegExp(`warn${notCompanion}`),
    new RegExp(`(amber|orange)${notCompanion}`),
  ]);
  const danger = pick([
    /^--(danger|destructive|error|red)$/,
    new RegExp(`(danger|destructive|error)${notCompanion}`),
    new RegExp(`(^|-)red${notCompanion}`),
  ]);

  const p = (f: Found, fallback: string) => (f ? paintable(f.value) : fallback);

  // Theme polarity drives the neutral fallbacks.
  const bgPaint = bg ? paintable(bg.value) : themeName === 'dark' ? '#101014' : '#f7f7f9';
  const bgLight = lightnessOf(bgPaint);
  const isDark = bgLight != null ? bgLight < 0.5 : themeName === 'dark';

  const textPaint = p(text, isDark ? '#f2f2f4' : '#1c1c21');
  const primaryPaint = p(primary, '#4c9bff');
  const primaryL = lightnessOf(primaryPaint);
  const primaryFgPaint = primaryFg
    ? paintable(primaryFg.value)
    : primaryL != null && primaryL > 0.62
      ? '#16161a'
      : '#ffffff';

  // Radii: use the project's scale when parseable, else sensible defaults.
  const radiusPx = ds.tokens
    .filter((t) => t.category === 'radius')
    .map((t) => {
      const m = /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec((resolved.get(t.name) ?? '').trim());
      return m ? parseFloat(m[1]) * (m[2] && m[2] !== 'px' ? 16 : 1) : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0 && n < 48)
    .sort((a, b) => a - b);
  const rMd = radiusPx.length ? radiusPx[Math.floor(radiusPx.length / 2)] : 10;
  const rSm = Math.max(4, Math.min(rMd - 2, 8));
  const rLg = radiusPx.length ? radiusPx[radiusPx.length - 1] : rMd + 6;

  const shadowTok =
    ds.tokens.find((t) => t.category === 'shadow' && /card/.test(t.name)) ??
    ds.tokens.find((t) => t.category === 'shadow');
  const shadow = shadowTok
    ? resolved.get(shadowTok.name)!
    : isDark
      ? '0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.6)'
      : '0 1px 2px rgba(16,16,20,.06), 0 8px 24px -12px rgba(16,16,20,.16)';

  const sans = ds.fonts.find((f) => f.role === 'sans')?.stack ?? 'ui-sans-serif, system-ui, sans-serif';
  const mono = ds.fonts.find((f) => f.role === 'mono')?.stack ?? 'ui-monospace, monospace';

  const surfacePaint = surface
    ? paintable(surface.value)
    : isDark
      ? 'color-mix(in srgb, #ffffff 5%, ' + bgPaint + ')'
      : '#ffffff';

  const vars = {
    '--p-bg': bgPaint,
    '--p-surface': surfacePaint,
    '--p-text': textPaint,
    '--p-muted': muted ? paintable(muted.value) : `color-mix(in srgb, ${textPaint} 55%, ${bgPaint})`,
    '--p-border': border
      ? paintable(border.value)
      : `color-mix(in srgb, ${textPaint} 14%, transparent)`,
    '--p-primary': primaryPaint,
    '--p-primary-fg': primaryFgPaint,
    '--p-success': p(success, '#31c47f'),
    '--p-warn': p(warn, '#eab040'),
    '--p-danger': p(danger, '#e5484d'),
    '--p-r-sm': `${rSm}px`,
    '--p-r-md': `${rMd}px`,
    '--p-r-lg': `${rLg}px`,
    '--p-shadow': shadow,
    '--p-sans': sans,
    '--p-mono': mono,
  } as CSSProperties;

  const mapping: Array<[string, string]> = [];
  const note = (role: string, f: Found) => f && mapping.push([role, f.name]);
  note('background', bg);
  note('surface', surface);
  note('text', text);
  note('primary', primary);
  note('border', border);
  note('success', success);
  note('danger', danger);

  return { vars, isDark, mapping };
}

/* --------------------------------- Page ----------------------------------- */

export default function DesignPreview() {
  const data = useData();
  const ds = data.designSystem;

  if (!ds || ds.counts.total === 0) {
    return (
      <>
        <Head />
        <div className="atlas-panel atlas-deadclear">
          <FiDroplet size={26} style={{ color: 'var(--ink-faint)' }} />
          <div>
            <h2 className="atlas-section-title" style={{ marginBottom: 4 }}>Nothing to preview</h2>
            <p className="atlas-faint">
              No design tokens were extracted from this project, so there is no palette to
              paint the template with.
            </p>
          </div>
        </div>
      </>
    );
  }

  const themes: ThemeInfo[] = ds.themes.length
    ? ds.themes
    : [{ name: 'base', selector: ':root', tokenCount: ds.counts.total }];

  return (
    <>
      <Head />
      <div className="atlas-prevgrid">
        {themes.map((t) => (
          <ThemeFrame key={t.name} ds={ds} theme={t} />
        ))}
      </div>
    </>
  );
}

function Head() {
  return (
    <div className="atlas-pagehead">
      <div className="atlas-pagehead-main">
        <h1 className="atlas-pagehead-title">Design preview</h1>
        <p className="atlas-pagehead-sub">
          A static product template painted with the tokens extracted from your codebase —
          one frame per theme.
        </p>
      </div>
      <div className="atlas-pagehead-side">
        <Button variant="secondary" size="sm" asChild>
          <Link to="/design">
            <FiArrowLeft size={14} />
            Token reference
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ThemeFrame({ ds, theme }: { ds: DesignSystemReport; theme: ThemeInfo }) {
  const data = useData();
  const { vars, isDark, mapping } = useMemo(() => deriveRoles(ds, theme.name), [ds, theme.name]);
  const Icon = isDark ? FiMoon : FiSun;
  return (
    <section className="atlas-prevframe">
      <div className="atlas-prevframe-head">
        <span className="atlas-pill">
          <Icon size={12} aria-hidden="true" />
          {theme.name === 'base' ? 'default' : theme.name}
        </span>
        <span className="atlas-panel-hint mono atlas-trunc" title={theme.selector}>
          {theme.selector}
        </span>
      </div>
      <Template projectName={folderName(data.meta.root)} vars={vars} />
      {mapping.length > 0 && (
        <p className="atlas-prevmap mono">
          {mapping.map(([role, token], i) => (
            <span key={role}>
              {i > 0 && <span className="atlas-dot-sep"> · </span>}
              {role} ← {token}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function folderName(p: string): string {
  if (!p) return 'Acme';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || 'Acme';
}

/* ------------------------------- Template --------------------------------- */

const CHART = [38, 52, 44, 66, 58, 72, 49, 80, 64, 90, 71, 56];

const ACTIVITY = [
  { who: 'MK', text: 'Meera approved the rollout plan', time: '12m', tone: '' },
  { who: 'DS', text: 'Deploy №482 finished in 3m 12s', time: '41m', tone: 'success' },
  { who: 'AT', text: 'Latency budget at 91% on edge-eu', time: '1h', tone: 'warn' },
  { who: 'RB', text: 'New API key created for staging', time: '3h', tone: '' },
];

const ROWS = [
  { name: 'api-gateway', env: 'production', status: 'Healthy', tone: 'success', when: '2m ago' },
  { name: 'ingest-worker', env: 'staging', status: 'Degraded', tone: 'warn', when: '18m ago' },
  { name: 'billing-sync', env: 'production', status: 'Failed', tone: 'danger', when: '1h ago' },
];

function Template({ projectName, vars }: { projectName: string; vars: CSSProperties }) {
  return (
    <div className="atlas-prev" style={vars}>
      {/* Top bar */}
      <header className="atlas-prev-topbar">
        <span className="atlas-prev-brand">
          <span className="atlas-prev-brandmark" />
          {projectName}
        </span>
        <nav className="atlas-prev-nav">
          <span className="is-active">Overview</span>
          <span>Reports</span>
          <span>Fleet</span>
          <span>Settings</span>
        </nav>
        <span className="atlas-prev-search">
          <FiSearch size={12} aria-hidden="true" />
          Search…
          <kbd>⌘K</kbd>
        </span>
        <span className="atlas-prev-iconbtn">
          <FiBell size={13} aria-hidden="true" />
        </span>
        <span className="atlas-prev-avatar">RD</span>
      </header>

      <div className="atlas-prev-body">
        {/* Hero */}
        <div className="atlas-prev-hero">
          <div>
            <h3>Good afternoon, Riya</h3>
            <p>Here’s what changed across your fleet in the last 24 hours.</p>
          </div>
          <div className="atlas-prev-heroactions">
            <button type="button" className="atlas-prev-btn atlas-prev-btn--ghost">Share</button>
            <button type="button" className="atlas-prev-btn atlas-prev-btn--primary">
              <FiPlus size={13} aria-hidden="true" />
              New report
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="atlas-prev-stats">
          <div className="atlas-prev-card atlas-prev-stat">
            <span className="atlas-prev-statlabel">Monthly volume</span>
            <span className="atlas-prev-statnum">48,210</span>
            <span className="atlas-prev-delta atlas-prev-delta--up">
              <FiArrowUpRight size={11} aria-hidden="true" /> 12.4%
            </span>
          </div>
          <div className="atlas-prev-card atlas-prev-stat">
            <span className="atlas-prev-statlabel">Active devices</span>
            <span className="atlas-prev-statnum">1,284</span>
            <span className="atlas-prev-delta atlas-prev-delta--up">
              <FiArrowUpRight size={11} aria-hidden="true" /> 3.1%
            </span>
          </div>
          <div className="atlas-prev-card atlas-prev-stat">
            <span className="atlas-prev-statlabel">Error rate</span>
            <span className="atlas-prev-statnum">0.42%</span>
            <span className="atlas-prev-delta atlas-prev-delta--down">−0.08%</span>
          </div>
        </div>

        {/* Chart + activity */}
        <div className="atlas-prev-mid">
          <div className="atlas-prev-card atlas-prev-chartcard">
            <div className="atlas-prev-cardhead">
              <span>Weekly throughput</span>
              <span className="atlas-prev-legend">
                <i />
                events / hour
              </span>
            </div>
            <div className="atlas-prev-chart" aria-hidden="true">
              {CHART.map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={i === 9 ? 'is-peak' : undefined}
                />
              ))}
            </div>
            <div className="atlas-prev-chartaxis" aria-hidden="true">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
          </div>

          <div className="atlas-prev-card atlas-prev-activity">
            <div className="atlas-prev-cardhead"><span>Recent activity</span></div>
            {ACTIVITY.map((a) => (
              <div key={a.text} className="atlas-prev-actrow">
                <span className="atlas-prev-actavatar">{a.who}</span>
                <span className="atlas-prev-acttext">{a.text}</span>
                {a.tone && <span className={`atlas-prev-dot atlas-prev-dot--${a.tone}`} />}
                <span className="atlas-prev-acttime">{a.time}</span>
              </div>
            ))}
            <button type="button" className="atlas-prev-btn atlas-prev-btn--ghost atlas-prev-btn--block">
              View all activity
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="atlas-prev-card atlas-prev-tablecard">
          <div className="atlas-prev-cardhead">
            <span>Deployments</span>
            <span className="atlas-prev-cardhint">Last 24 hours</span>
          </div>
          <table className="atlas-prev-table">
            <thead>
              <tr><th>Service</th><th>Environment</th><th>Status</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name}>
                  <td className="atlas-prev-mono">{r.name}</td>
                  <td><span className="atlas-prev-tag">{r.env}</span></td>
                  <td>
                    <span className={`atlas-prev-status atlas-prev-status--${r.tone}`}>
                      <i />
                      {r.status}
                    </span>
                  </td>
                  <td className="atlas-prev-dim">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
