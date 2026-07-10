/**
 * Design System view — a getdesign.md-style presentation of the tokens Atlas
 * extracted from the project's stylesheets: color swatches, typography,
 * spacing/radius/shadow scales, plus the generated DESIGN.md with copy and
 * download actions. The theme switcher re-resolves every token against the
 * selected theme scope so overrides can be previewed live.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiCopy, FiDownload, FiDroplet, FiEye, FiMoon, FiSun } from 'react-icons/fi';
import { useData } from '../data';
import type { DesignSystemReport, DesignToken, TokenCategory } from '../types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildResolved, findTokenEntry, paintable, themedValue } from '../lib/tokens';

function useResolved(tokens: DesignToken[], theme: string): Map<string, string> {
  return useMemo(() => buildResolved(tokens, theme), [tokens, theme]);
}

/** First resolved token value whose name matches one of the patterns. */
function findToken(resolved: Map<string, string>, patterns: RegExp[]): string | undefined {
  return findTokenEntry(resolved, patterns)?.value;
}

const THEME_ICON: Record<string, typeof FiSun> = { light: FiSun, dark: FiMoon };

/* --------------------------------- View ----------------------------------- */

export default function DesignSystem() {
  const data = useData();
  const ds = data.designSystem;

  if (!ds || (ds.counts.total === 0 && ds.fonts.length === 0 && ds.literalColors.length === 0)) {
    return (
      <>
        <Head ds={undefined} />
        <div className="atlas-panel atlas-deadclear">
          <FiDroplet size={26} style={{ color: 'var(--ink-faint)' }} />
          <div>
            <h2 className="atlas-section-title" style={{ marginBottom: 4 }}>No design tokens found</h2>
            <p className="atlas-faint">
              Atlas looks for CSS custom properties on <span className="mono">:root</span>/theme scopes in
              your stylesheets, plus Tailwind theme values. Re-run{' '}
              <span className="mono">atlas analyze</span> after adding tokens.
            </p>
          </div>
        </div>
      </>
    );
  }

  return <Report ds={ds} />;
}

function Report({ ds }: { ds: DesignSystemReport }) {
  const themes = ds.themes.length ? ds.themes : [{ name: 'base', selector: ':root', tokenCount: 0 }];
  const [theme, setTheme] = useState(themes[0]?.name ?? 'base');
  const resolved = useResolved(ds.tokens, theme);

  // Paint previews on the analyzed project's own surfaces when we can find them.
  const previewBg = findToken(resolved, [
    /^--(background|canvas|bg)$/,
    /background|canvas/,
    /^--(surface|base)(-\d)?$/,
  ]);
  const previewInk = findToken(resolved, [/^--(foreground|ink|text)$/, /foreground|ink|text-primary/]);
  const previewStyle = previewBg
    ? {
        background: paintable(previewBg),
        color: previewInk ? paintable(previewInk) : undefined,
        boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
      }
    : undefined;

  const byCat = useMemo(() => {
    const m = new Map<TokenCategory, DesignToken[]>();
    for (const t of ds.tokens) {
      const list = m.get(t.category) ?? [];
      list.push(t);
      m.set(t.category, list);
    }
    return m;
  }, [ds.tokens]);

  const colors = [...(byCat.get('color') ?? []), ...(byCat.get('gradient') ?? [])];
  const sizes = byCat.get('font-size') ?? [];
  const weights = byCat.get('font-weight') ?? [];
  const spacing = byCat.get('spacing') ?? [];
  const radii = byCat.get('radius') ?? [];
  const shadows = byCat.get('shadow') ?? [];
  const misc = [
    ...(byCat.get('motion') ?? []),
    ...(byCat.get('z-index') ?? []),
    ...(byCat.get('breakpoint') ?? []),
    ...(byCat.get('other') ?? []),
  ];

  const kpis = [
    { label: 'Colors', n: ds.counts.colors, hue: 'var(--t-component)' },
    { label: 'Fonts', n: ds.counts.fonts, hue: 'var(--t-hook)' },
    { label: 'Spacing', n: ds.counts.spacing, hue: 'var(--t-utility)' },
    { label: 'Radii', n: ds.counts.radii, hue: 'var(--t-context)' },
    { label: 'Shadows', n: ds.counts.shadows, hue: 'var(--t-provider)' },
  ];

  return (
    <>
      <Head ds={ds}>
        {themes.length > 1 && (
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => v && setTheme(v)}
            className="flex flex-wrap gap-1.5"
            aria-label="Preview theme"
          >
            {themes.map((t) => {
              const Icon = THEME_ICON[t.name];
              return (
                <ToggleGroupItem key={t.name} value={t.name} title={`Preview tokens under ${t.selector}`}>
                  {Icon && <Icon size={13} aria-hidden="true" />}
                  {t.name === 'base' ? 'default' : t.name}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        )}
        <Button variant="secondary" size="sm" asChild title="See the tokens applied to a real UI template">
          <Link to="/design/preview">
            <FiEye size={14} />
            Live preview
          </Link>
        </Button>
        <CopyButton text={ds.markdown} label="Copy DESIGN.md" />
        <DownloadButton markdown={ds.markdown} />
      </Head>

      <div className="atlas-kpis" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))', marginBottom: 'var(--bento-gap)' }}>
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

      <div className="atlas-bento-stack">
        {colors.length > 0 && (
          <section className="atlas-panel">
            <SectionHead
              title="Colors"
              hint={theme === 'base' ? 'Base theme values' : `Resolved for the “${theme}” theme`}
            />
            <div className="atlas-swatchgrid">
              {colors.map((t) => (
                <ColorSwatch key={t.name} token={t} theme={theme} resolved={resolved} />
              ))}
            </div>
          </section>
        )}

        {(ds.fonts.length > 0 || sizes.length > 0 || weights.length > 0) && (
          <section className="atlas-panel">
            <SectionHead title="Typography" hint={`${ds.fonts.length} famil${ds.fonts.length === 1 ? 'y' : 'ies'}`} />
            <div className="atlas-fontlist">
              {ds.fonts.map((f) => (
                <div key={f.stack} className="atlas-fontcard">
                  <div className="atlas-fontcard-preview" style={{ fontFamily: f.stack }}>
                    Ag
                  </div>
                  <div className="atlas-fontcard-meta">
                    <div className="atlas-fontcard-name">
                      {f.family}
                      <Badge variant="tag">{f.role}</Badge>
                    </div>
                    <p
                      className="atlas-fontcard-sample"
                      style={{ fontFamily: f.stack }}
                    >
                      The quick brown fox jumps over the lazy dog — 0123456789
                    </p>
                    <p className="atlas-fontcard-stack mono atlas-trunc" title={f.stack}>{f.stack}</p>
                  </div>
                </div>
              ))}
            </div>
            {(sizes.length > 0 || weights.length > 0) && (
              <div className="atlas-typescale">
                {sizes.map((t) => (
                  <div key={t.name} className="atlas-typescale-row">
                    <TokenName token={t} />
                    <span className="atlas-typescale-sample" style={{ fontSize: clampPx(resolved.get(t.name), 11, 40) }}>
                      Aa
                    </span>
                    <span className="mono atlas-faint">{themedValue(t, theme)}</span>
                  </div>
                ))}
                {weights.map((t) => (
                  <div key={t.name} className="atlas-typescale-row">
                    <TokenName token={t} />
                    <span className="atlas-typescale-sample" style={{ fontWeight: Number(resolved.get(t.name)) || 400, fontSize: 20 }}>
                      Aa
                    </span>
                    <span className="mono atlas-faint">{themedValue(t, theme)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {(spacing.length > 0 || radii.length > 0) && (
          <div className="atlas-bento-row" style={{ gridTemplateColumns: spacing.length && radii.length ? '1.4fr 1fr' : '1fr' }}>
            {spacing.length > 0 && (
              <section className="atlas-panel">
                <SectionHead title="Spacing" hint="Relative scale" />
                <div className="atlas-scalerows">
                  {spacing.map((t) => (
                    <div key={t.name} className="atlas-scalerow">
                      <TokenName token={t} />
                      <div className="atlas-scalebar-track">
                        <span
                          className="atlas-scalebar"
                          style={{ width: clampPx(resolved.get(t.name), 2, 220) }}
                        />
                      </div>
                      <span className="mono atlas-faint">{themedValue(t, theme)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {radii.length > 0 && (
              <section className="atlas-panel">
                <SectionHead title="Border radius" hint="Applied to a 56px tile" />
                <div className="atlas-radiigrid">
                  {radii.map((t) => (
                    <div key={t.name} className="atlas-radiicell">
                      <span className="atlas-radiibox" style={{ borderRadius: resolved.get(t.name) }} />
                      <TokenName token={t} />
                      <span className="mono atlas-faint">{themedValue(t, theme)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {shadows.length > 0 && (
          <section className="atlas-panel">
            <SectionHead title="Shadows" hint="Elevation styles" />
            <div className="atlas-shadowgrid">
              {shadows.map((t) => (
                <div key={t.name} className="atlas-shadowcell">
                  <span className="atlas-shadowstage" style={previewStyle}>
                    <span
                      className="atlas-shadowbox"
                      style={{
                        boxShadow: resolved.get(t.name),
                        background: previewBg ? paintable(previewBg) : 'var(--surface-2)',
                      }}
                    />
                  </span>
                  <TokenName token={t} />
                </div>
              ))}
            </div>
          </section>
        )}

        {misc.length > 0 && (
          <section className="atlas-panel">
            <SectionHead title="Other tokens" hint="Motion, breakpoints, z-index and the rest" />
            <div className="atlas-table-wrap">
              <table className="atlas-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Category</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {misc.map((t) => (
                    <tr key={t.name}>
                      <td className="mono">{t.name}</td>
                      <td><Badge variant="tag">{t.category}</Badge></td>
                      <td className="mono atlas-faint" style={{ overflowWrap: 'anywhere' }}>{themedValue(t, theme)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {ds.literalColors.length > 0 && (
          <section className="atlas-panel">
            <SectionHead title="Palette in use" hint="Literal colors found in declarations, by frequency" />
            <div className="atlas-literalrow">
              {ds.literalColors.map((c) => (
                <CopyChip key={c.value} value={c.value} count={c.count} />
              ))}
            </div>
          </section>
        )}

        <section className="atlas-panel">
          <div className="atlas-panel-head">
            <div>
              <h2 className="atlas-section-title">DESIGN.md</h2>
              <p className="atlas-panel-hint" style={{ marginTop: 4 }}>
                Machine-readable summary of this design system — drop it next to your AGENTS/CLAUDE.md
                so coding agents follow the house style.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <CopyButton text={ds.markdown} label="Copy" />
              <DownloadButton markdown={ds.markdown} />
            </div>
          </div>
          <pre className="atlas-code atlas-designmd">{ds.markdown}</pre>
        </section>
      </div>
    </>
  );
}

/* ------------------------------ Sub-components ---------------------------- */

function Head({ ds, children }: { ds?: DesignSystemReport; children?: React.ReactNode }) {
  return (
    <div className="atlas-pagehead">
      <div className="atlas-pagehead-main">
        <h1 className="atlas-pagehead-title">Design system</h1>
        <p className="atlas-pagehead-sub">
          Tokens extracted from your stylesheets — colors, typography, spacing and shadows,
          rendered as a shareable DESIGN.md.
          {ds && ds.sources.length > 0 && (
            <>
              <span className="atlas-dot-sep">·</span>
              <span>
                {ds.counts.total} tokens from {ds.sources.length} file{ds.sources.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </p>
      </div>
      {children && <div className="atlas-pagehead-side">{children}</div>}
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="atlas-panel-head">
      <h2 className="atlas-section-title">{title}</h2>
      {hint && <span className="atlas-panel-hint">{hint}</span>}
    </div>
  );
}

function TokenName({ token }: { token: DesignToken }) {
  return (
    <span className="mono atlas-tokenname atlas-trunc" title={`${token.name} — ${token.source ?? ''}`}>
      {token.name}
    </span>
  );
}

function ColorSwatch({
  token,
  theme,
  resolved,
}: {
  token: DesignToken;
  theme: string;
  resolved: Map<string, string>;
}) {
  const [copied, setCopied] = useState(false);
  const shown = themedValue(token, theme);
  const paint = resolved.get(token.name) ?? shown;
  const overridden = theme !== 'base' && token.themeValues != null && theme in token.themeValues;

  const copy = () => {
    copyText(shown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <button
      type="button"
      className="atlas-swatch"
      onClick={copy}
      title={`${token.name}: ${shown}\nClick to copy`}
    >
      <span className="atlas-swatch-chip" style={{ background: paintable(paint) }}>
        {copied && <FiCheck size={14} aria-hidden="true" />}
      </span>
      <span className="atlas-swatch-meta">
        <span className="mono atlas-swatch-name atlas-trunc">
          {token.name}
          {overridden && <span className="atlas-swatch-override" title={`Overridden by the ${theme} theme`} />}
        </span>
        <span className="mono atlas-swatch-value atlas-trunc">{shown}</span>
      </span>
    </button>
  );
}

function CopyChip({ value, count }: { value: string; count: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="atlas-literalchip"
      title={`${value} — used ${count}×. Click to copy.`}
      onClick={() =>
        copyText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        })
      }
    >
      <span className="atlas-literalchip-dot" style={{ background: value }} />
      <span className="mono">{copied ? 'copied' : value}</span>
      <span className="atlas-literalchip-count tnum">{count}</span>
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        copyText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        })
      }
      title="Copy the DESIGN.md markdown to the clipboard"
    >
      {copied ? <FiCheck size={14} style={{ color: 'var(--success)' }} /> : <FiCopy size={14} />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function DownloadButton({ markdown }: { markdown: string }) {
  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DESIGN.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="primary" size="sm" onClick={download} title="Download DESIGN.md">
      <FiDownload size={14} />
      Download DESIGN.md
    </Button>
  );
}

/* --------------------------------- Utils ---------------------------------- */

/** Clipboard write with a legacy fallback for non-secure contexts. */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

/** Parse a CSS length to px for previews (rem/em assumed 16px), clamped. */
function clampPx(value: string | undefined, min: number, max: number): number {
  if (!value) return min;
  const m = /^(-?\d+(?:\.\d+)?)(px|rem|em)?$/.exec(value.trim());
  if (!m) return min;
  const n = parseFloat(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1);
  return Math.max(min, Math.min(max, Math.abs(n)));
}

