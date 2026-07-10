/**
 * Design-system extraction.
 *
 * Scans the project's stylesheets (css/scss/sass/less) for design tokens —
 * CSS custom properties declared on root/theme scopes — plus font stacks,
 * literal color usage, and a best-effort read of tailwind.config theme values.
 * Tokens keep per-theme override values so the dashboard can preview themes.
 */
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import fg from 'fast-glob';
import { Project, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';
import type {
  DesignSystemReport,
  DesignToken,
  FontInfo,
  ResolvedConfig,
  ThemeInfo,
  TokenCategory,
} from '../core/types';

const STYLE_GLOBS = ['**/*.{css,scss,sass,less}'];
const TAILWIND_GLOBS = ['**/tailwind.config.{js,cjs,mjs,ts}'];
/** Cap pathological inputs (vendored/minified bundles that slipped the excludes). */
const MAX_FILE_BYTES = 1_500_000;

/* ------------------------------ CSS scanning ------------------------------ */

interface Decl {
  prop: string;
  value: string;
}

interface Block {
  /** Selector chain from the top, e.g. ['@media (prefers-color-scheme: dark)', ':root']. */
  chain: string[];
  decls: Decl[];
}

/**
 * Minimal block scanner — enough CSS/SCSS structure to know, for every
 * declaration, the full selector chain it sits under. Not a validating parser.
 */
export function scanCssBlocks(css: string): Block[] {
  const src = stripComments(css);
  const blocks: Block[] = [];
  const stack: Block[] = [];
  let buf = '';

  const flushDecl = () => {
    const text = buf.trim();
    buf = '';
    if (!text || stack.length === 0) return;
    const colon = text.indexOf(':');
    if (colon <= 0) return;
    const prop = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();
    if (prop && value) stack[stack.length - 1].decls.push({ prop, value });
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      // Consume the whole string so braces/semicolons inside don't confuse us.
      const quote = ch;
      buf += ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          buf += src[i];
          i++;
        }
        if (i < src.length) buf += src[i];
        i++;
      }
      if (i < src.length) buf += src[i];
    } else if (ch === '{') {
      const selector = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      const parent = stack[stack.length - 1];
      const block: Block = { chain: [...(parent?.chain ?? []), selector], decls: [] };
      blocks.push(block);
      stack.push(block);
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
    } else if (ch === ';') {
      flushDecl();
    } else {
      buf += ch;
    }
  }
  return blocks;
}

function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // SCSS line comments — avoid eating `//` inside url(https://…).
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* ------------------------------ Theme scoping ----------------------------- */

/**
 * Decide which theme a selector chain belongs to, and whether it is a
 * root-level scope where custom properties count as design tokens.
 * Returns null for component-scoped declarations (e.g. `.button { --pad: … }`).
 */
export function themeOfChain(chain: string[]): { theme: string; selector: string } | null {
  let theme: string | null = null;
  let rootish = false;
  const themeSelectors: string[] = [];

  for (const part of chain) {
    if (part.startsWith('@media')) {
      const m = /prefers-color-scheme\s*:\s*(dark|light)/.exec(part);
      if (m) {
        theme = m[1];
        themeSelectors.push(part);
      }
      continue;
    }
    if (part.startsWith('@')) continue; // @supports, @layer … — neutral wrappers

    const dataTheme = /\[data-(?:theme|mode|color-mode|color-scheme)[*^|~]?=["']?([\w-]+)/.exec(part);
    const classTheme = /\.theme-([\w-]+)/.exec(part) || /\.(dark|light)(?![\w-])/.exec(part);
    if (dataTheme || classTheme) {
      theme = (dataTheme?.[1] ?? classTheme?.[1]) as string;
      themeSelectors.push(part);
      rootish = true; // a theme scope is a token scope by definition
      continue;
    }
    if (/(?:^|[\s,])(?::root|html|body|\*)(?![\w-])/.test(part)) {
      rootish = true;
      themeSelectors.push(part);
    } else if (part) {
      // A concrete component selector in the chain → not a global token scope.
      return null;
    }
  }

  if (!rootish) return null;
  return { theme: theme ?? 'base', selector: themeSelectors.join(' ') || chain.join(' ') };
}

/* ---------------------------- Classification ------------------------------ */

const COLOR_VALUE =
  /(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color-mix\(|light-dark\()/;
/** shadcn/Tailwind channel triples used via `hsl(var(--x))` / `rgb(var(--x))`. */
const HSL_TRIPLE =
  /^\d+(\.\d+)?(deg)?(\s*,\s*|\s+)\d+(\.\d+)?%(\s*,\s*|\s+)\d+(\.\d+)?%(\s*\/\s*[\d.]+%?)?$/;
const RGB_TRIPLE = /^\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*\/\s*[\d.]+%?)?$/;
const LENGTH_VALUE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|ch|ex)?$/;
const COLOR_NAME =
  /color|bg\b|background|surface|ink|text|border|accent|brand|primary|secondary|tertiary|success|warn|danger|error|info|muted|foreground|canvas|hairline|fill|stroke|overlay|ring/i;

export function classifyToken(name: string, value: string): TokenCategory {
  const n = name.toLowerCase();
  const v = value.trim();

  if (/gradient\(/.test(v)) return 'gradient';
  if (/shadow|elevation/.test(n)) return 'shadow';
  if (/font(-|_)?(family|display|body|mono|sans|serif|heading)|^--font(s)?(-|$)/.test(n) || /\b(sans-serif|serif|monospace|system-ui|ui-monospace|ui-sans-serif)\b/.test(v))
    return 'font';
  if (/font-?size|text-(xs|sm|base|md|lg|\d*xl)/.test(n) && LENGTH_VALUE.test(v)) return 'font-size';
  if (/font-?weight|weight/.test(n) && /^\d{3}$/.test(v)) return 'font-weight';
  if (/radius|rounded|^--r-|-r-(xs|sm|md|lg|xl|pill|full)/.test(n)) return 'radius';
  if (/duration|delay|easing|ease\b|transition|anim/.test(n) || /cubic-bezier\(|^\d+m?s$/.test(v))
    return 'motion';
  if (/z-?index|^--z-/.test(n) && /^-?\d+$/.test(v)) return 'z-index';
  if (/breakpoint|^--bp-|screen-(sm|md|lg|xl)/.test(n)) return 'breakpoint';
  if (COLOR_VALUE.test(v)) return 'color';
  if (HSL_TRIPLE.test(v) || RGB_TRIPLE.test(v)) return 'color';
  if (COLOR_NAME.test(n) && !LENGTH_VALUE.test(v) && !/var\(/.test(v)) return 'color';
  if (COLOR_NAME.test(n) && /^var\(--/.test(v)) return 'color'; // alias to another color token
  if (
    /space|spacing|gap|pad(ding)?|margin|inset|offset|-w$|-h$|width|height|size/.test(n) &&
    LENGTH_VALUE.test(v)
  )
    return 'spacing';
  if (LENGTH_VALUE.test(v) && v !== '0') return 'spacing';
  return 'other';
}

/* -------------------------------- Fonts ----------------------------------- */

function familyOf(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? stack;
  return first.replace(/^["']|["']$/g, '');
}

function roleOf(stack: string): FontInfo['role'] {
  const s = stack.toLowerCase();
  if (/monospace|ui-monospace|mono\b/.test(s)) return 'mono';
  if (/(^|,|\s)serif\s*(,|$)/.test(s) && !/sans-serif/.test(s)) return 'serif';
  return 'sans';
}

/* ------------------------------ Tailwind ---------------------------------- */

const TW_GROUPS: Record<string, TokenCategory> = {
  colors: 'color',
  fontFamily: 'font',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  spacing: 'spacing',
  borderRadius: 'radius',
  boxShadow: 'shadow',
  screens: 'breakpoint',
  transitionTimingFunction: 'motion',
  transitionDuration: 'motion',
};

/** Best-effort static read of tailwind.config theme values (literals only). */
function extractTailwindTokens(cfgPath: string, rel: string): DesignToken[] {
  const tokens: DesignToken[] = [];
  try {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });
    const sf = project.addSourceFileAtPathIfExists(cfgPath);
    if (!sf) return tokens;

    const flatten = (obj: ObjectLiteralExpression, prefix: string, category: TokenCategory) => {
      for (const prop of obj.getProperties()) {
        if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
        const key = prop.getName().replace(/^["']|["']$/g, '');
        const init = prop.getInitializer();
        if (!init) continue;
        const name = prefix ? `${prefix}.${key}` : key;
        if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          flatten(init, name, category);
        } else if (
          init.isKind(SyntaxKind.StringLiteral) ||
          init.isKind(SyntaxKind.NoSubstitutionTemplateLiteral) ||
          init.isKind(SyntaxKind.NumericLiteral)
        ) {
          tokens.push({ name, value: String(init.getLiteralValue()), category, source: rel });
        } else if (init.isKind(SyntaxKind.ArrayLiteralExpression)) {
          const parts = init
            .getElements()
            .filter((e) => e.isKind(SyntaxKind.StringLiteral))
            .map((e) => e.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue());
          if (parts.length) tokens.push({ name, value: parts.join(', '), category, source: rel });
        }
      }
    };

    for (const themeProp of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (themeProp.getName() !== 'theme') continue;
      const themeObj = themeProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
      if (!themeObj) continue;
      const walkGroups = (obj: ObjectLiteralExpression) => {
        for (const prop of obj.getProperties()) {
          if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
          const key = prop.getName().replace(/^["']|["']$/g, '');
          const init = prop.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
          if (!init) continue;
          if (key === 'extend') walkGroups(init);
          else if (key in TW_GROUPS) flatten(init, key, TW_GROUPS[key]);
        }
      };
      walkGroups(themeObj);
      break; // first theme object is the config's
    }
  } catch {
    /* best-effort — a dynamic config just contributes nothing */
  }
  return tokens;
}

/* --------------------------------- Main ----------------------------------- */

const CATEGORY_ORDER: TokenCategory[] = [
  'color',
  'gradient',
  'font',
  'font-size',
  'font-weight',
  'spacing',
  'radius',
  'shadow',
  'motion',
  'z-index',
  'breakpoint',
  'other',
];

export function analyzeDesignSystem(config: ResolvedConfig): Omit<DesignSystemReport, 'markdown'> {
  const styleFiles = fg.sync(STYLE_GLOBS, {
    cwd: config.root,
    ignore: config.exclude,
    absolute: true,
    suppressErrors: true,
  });
  const twConfigs = fg.sync(TAILWIND_GLOBS, {
    cwd: config.root,
    ignore: config.exclude,
    absolute: true,
    suppressErrors: true,
  });

  const byName = new Map<string, DesignToken>();
  const themeMeta = new Map<string, { selector: string; count: number }>();
  const fontsByStack = new Map<string, FontInfo>();
  const literalCounts = new Map<string, number>();
  const sources = new Set<string>();

  const noteFont = (stack: string, source: string) => {
    const cleaned = stack.trim();
    // A bare token reference or CSS-wide keyword is not a font stack.
    if (/^var\(--[\w-]+\)$/.test(cleaned) || /^(inherit|initial|unset|revert(-layer)?)$/i.test(cleaned)) return;
    const family = familyOf(cleaned);
    const key = family.toLowerCase();
    if (!fontsByStack.has(key)) {
      fontsByStack.set(key, { family, stack: cleaned, role: roleOf(cleaned), source });
    }
  };

  for (const abs of styleFiles) {
    let css: string;
    try {
      css = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (css.length > MAX_FILE_BYTES) continue;
    const rel = relative(config.root, abs).replace(/\\/g, '/');

    for (const block of scanCssBlocks(css)) {
      // Literal colors + font stacks come from every declaration.
      for (const { prop, value } of block.decls) {
        if (prop === 'font-family') noteFont(value, rel);
        if (!prop.startsWith('--')) {
          for (const m of value.matchAll(
            /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g,
          )) {
            const c = m[0].toLowerCase().replace(/\s+/g, '');
            literalCounts.set(c, (literalCounts.get(c) ?? 0) + 1);
          }
        }
      }

      const scope = themeOfChain(block.chain);
      if (!scope) continue;

      for (const { prop, value } of block.decls) {
        if (!prop.startsWith('--')) continue;
        sources.add(rel);

        const meta = themeMeta.get(scope.theme) ?? { selector: scope.selector, count: 0 };
        meta.count += 1;
        themeMeta.set(scope.theme, meta);

        const existing = byName.get(prop);
        const category = existing?.category ?? classifyToken(prop, value);
        if (!existing) {
          const token: DesignToken = { name: prop, value, category, source: rel };
          if (scope.theme !== 'base') token.themeValues = { [scope.theme]: value };
          byName.set(prop, token);
        } else if (scope.theme === 'base') {
          existing.value = value; // last base declaration wins, like the cascade
        } else {
          existing.themeValues = { ...existing.themeValues, [scope.theme]: value };
        }

        if (category === 'font') noteFont(value, rel);
      }
    }
  }

  for (const abs of twConfigs) {
    const rel = relative(config.root, abs).replace(/\\/g, '/');
    const twTokens = extractTailwindTokens(abs, rel);
    for (const t of twTokens) {
      if (!byName.has(t.name)) {
        byName.set(t.name, t);
        sources.add(rel);
        const meta = themeMeta.get('base') ?? { selector: ':root', count: 0 };
        meta.count += 1;
        themeMeta.set('base', meta);
        if (t.category === 'font') noteFont(t.value, rel);
      }
    }
  }

  const tokens = [...byName.values()].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  const themes: ThemeInfo[] = [...themeMeta.entries()]
    .map(([name, m]) => ({ name, selector: m.selector, tokenCount: m.count }))
    .sort((a, b) => (a.name === 'base' ? -1 : b.name === 'base' ? 1 : a.name.localeCompare(b.name)));

  const literalColors = [...literalCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const count = (c: TokenCategory) => tokens.filter((t) => t.category === c).length;

  return {
    tokens,
    themes,
    fonts: [...fontsByStack.values()],
    literalColors,
    sources: [...sources].sort(),
    counts: {
      colors: count('color') + count('gradient'),
      fonts: fontsByStack.size,
      spacing: count('spacing'),
      radii: count('radius'),
      shadows: count('shadow'),
      total: tokens.length,
    },
  };
}
