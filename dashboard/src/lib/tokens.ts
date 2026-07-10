/** Shared helpers for working with extracted design tokens (Design views). */
import type { DesignToken } from '../types';

/** Value of a token under a theme: the override if present, else base. */
export function themedValue(t: DesignToken, theme: string): string {
  if (theme !== 'base' && t.themeValues && theme in t.themeValues) return t.themeValues[theme];
  return t.value;
}

/**
 * Map of token name → fully-resolved value for a theme, substituting
 * `var(--x)` references (with fallbacks) so values can be painted directly.
 */
export function buildResolved(tokens: DesignToken[], theme: string): Map<string, string> {
  const raw = new Map(tokens.map((t) => [t.name, themedValue(t, theme)]));
  const resolve = (value: string, depth: number): string => {
    if (depth > 6 || !value.includes('var(')) return value;
    return value.replace(
      /var\((--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
      (m, name, fallback) => {
        const ref = raw.get(name);
        if (ref != null) return resolve(ref, depth + 1);
        return fallback != null ? resolve(fallback, depth + 1) : m;
      },
    );
  };
  const out = new Map<string, string>();
  for (const [name, value] of raw) out.set(name, resolve(value, 0));
  return out;
}

/**
 * Make a token value paintable as CSS. shadcn/Tailwind projects store raw
 * channel triples ("210 40% 96.1%") meant for `hsl(var(--x))` — wrap those so
 * swatches actually render. Comma-separated legacy triples are handled too.
 */
export function paintable(value: string): string {
  const v = value.trim();
  if (/^\d+(\.\d+)?(deg)?(\s*,\s*|\s+)\d+(\.\d+)?%(\s*,\s*|\s+)\d+(\.\d+)?%(\s*\/\s*[\d.]+%?)?$/.test(v)) {
    return `hsl(${v})`;
  }
  if (/^\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*\/\s*[\d.]+%?)?$/.test(v)) {
    return `rgb(${v})`;
  }
  return v;
}

/** First resolved token whose name matches, in pattern priority order. */
export function findTokenEntry(
  resolved: Map<string, string>,
  patterns: RegExp[],
): { name: string; value: string } | undefined {
  for (const re of patterns) {
    for (const [name, value] of resolved) {
      if (re.test(name)) return { name, value };
    }
  }
  return undefined;
}

/**
 * Approximate relative lightness (0..1) of a CSS color, best-effort across
 * hex / rgb() / hsl() / raw channel triples / oklch(). Null when unparseable.
 */
export function lightnessOf(css: string): number | null {
  const v = css.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  if (rgb) {
    return (0.2126 * +rgb[1] + 0.7152 * +rgb[2] + 0.0722 * +rgb[3]) / 255;
  }

  // hsl(h s% l%) / hsl(h, s%, l%) / raw "h s% l%" triple → third number is L.
  const hsl = /^(?:hsla?\(\s*)?\d+(?:\.\d+)?(?:deg)?[\s,]+\d+(?:\.\d+)?%[\s,]+(\d+(?:\.\d+)?)%/.exec(v);
  if (hsl) return +hsl[1] / 100;

  const oklch = /^oklch\(\s*(\d*\.?\d+)/.exec(v);
  if (oklch) {
    const l = +oklch[1];
    return l > 1 ? l / 100 : l; // "0.7" or "70%"
  }

  return null;
}
