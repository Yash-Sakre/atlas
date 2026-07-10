import { describe, it, expect } from 'vitest';
import { join } from 'path';
import {
  analyzeDesignSystem,
  classifyToken,
  scanCssBlocks,
  themeOfChain,
} from '../src/analysis/designSystem';
import { renderDesignMarkdown } from '../src/analysis/designMarkdown';
import type { ResolvedConfig } from '../src/core/types';

const FIXTURE = join(__dirname, 'fixtures', 'design');

const config: ResolvedConfig = {
  root: FIXTURE,
  include: ['**/*.{ts,tsx,js,jsx}'],
  exclude: ['**/node_modules/**'],
  cache: false,
  outDir: '.atlas',
  plugins: [],
  sharedLayers: [],
};

describe('scanCssBlocks', () => {
  it('tracks selector chains through nested at-rules', () => {
    const blocks = scanCssBlocks(
      '@media (prefers-color-scheme: dark) { :root { --a: 1px; } } .x { color: red }',
    );
    const rootBlock = blocks.find((b) => b.chain.includes(':root'));
    expect(rootBlock?.chain).toEqual(['@media (prefers-color-scheme: dark)', ':root']);
    expect(rootBlock?.decls).toEqual([{ prop: '--a', value: '1px' }]);
    // Last declaration before `}` (no trailing semicolon) is still captured.
    expect(blocks.find((b) => b.chain[0] === '.x')?.decls).toEqual([
      { prop: 'color', value: 'red' },
    ]);
  });

  it('ignores braces and semicolons inside strings and comments', () => {
    const blocks = scanCssBlocks(
      ':root { /* } ; */ --icon: url("a;b.svg"); --q: "x;y"; }',
    );
    expect(blocks[0].decls.map((d) => d.prop)).toEqual(['--icon', '--q']);
  });
});

describe('themeOfChain', () => {
  it('classifies root scopes as base', () => {
    expect(themeOfChain([':root'])?.theme).toBe('base');
    expect(themeOfChain(['html'])?.theme).toBe('base');
  });

  it('detects dark/light class, data-theme and media scopes', () => {
    expect(themeOfChain(['.dark'])?.theme).toBe('dark');
    expect(themeOfChain([':root.dark'])?.theme).toBe('dark');
    expect(themeOfChain(['[data-theme="ocean"]'])?.theme).toBe('ocean');
    expect(themeOfChain(['@media (prefers-color-scheme: dark)', ':root'])?.theme).toBe('dark');
  });

  it('rejects component-scoped custom properties', () => {
    expect(themeOfChain(['.button'])).toBeNull();
    expect(themeOfChain([':root', '.button'])).toBeNull();
  });
});

describe('classifyToken', () => {
  it.each([
    ['--brand', '#4c9bff', 'color'],
    ['--accent-ring', 'rgba(76,155,255,0.34)', 'color'],
    ['--hero', 'linear-gradient(#000, #fff)', 'gradient'],
    ['--font-body', '"Inter", sans-serif', 'font'],
    ['--r-md', '9px', 'radius'],
    ['--radius-lg', '1rem', 'radius'],
    ['--shadow-card', '0 1px 2px rgba(0,0,0,.4)', 'shadow'],
    ['--space-4', '16px', 'spacing'],
    ['--sidebar-w', '256px', 'spacing'],
    ['--ease-out', 'cubic-bezier(0.2, 0, 0, 1)', 'motion'],
    ['--z-modal', '100', 'z-index'],
  ] as const)('%s: %s → %s', (name, value, expected) => {
    expect(classifyToken(name, value)).toBe(expected);
  });
});

describe('analyzeDesignSystem (fixture)', () => {
  const report = analyzeDesignSystem(config);
  const byName = new Map(report.tokens.map((t) => [t.name, t]));

  it('extracts root tokens with categories', () => {
    expect(byName.get('--brand')?.category).toBe('color');
    expect(byName.get('--brand')?.value).toBe('#4c9bff');
    expect(byName.get('--font-body')?.category).toBe('font');
    expect(byName.get('--space-2')?.category).toBe('spacing');
    expect(byName.get('--r-md')?.category).toBe('radius');
  });

  it('records theme overrides without losing base values', () => {
    const bg = byName.get('--bg');
    expect(bg?.value).toBe('#ffffff');
    expect(bg?.themeValues?.dark).toBe('#0b0a09');
    expect(byName.get('--brand')?.themeValues?.ocean).toBe('#12a5b8');
    // Media-query dark override merges into the same "dark" theme.
    expect(byName.get('--shadow-card')?.themeValues?.dark).toContain('0.8');
  });

  it('discovers themes and skips component-scoped props', () => {
    expect(report.themes.map((t) => t.name)).toEqual(['base', 'dark', 'ocean']);
    expect(byName.has('--pad')).toBe(false);
  });

  it('collects fonts and literal colors', () => {
    const families = report.fonts.map((f) => f.family);
    expect(families).toContain('Inter');
    expect(families).toContain('Georgia');
    expect(report.fonts.find((f) => f.family === 'JetBrains Mono')?.role).toBe('mono');
    expect(report.literalColors.find((c) => c.value === '#123456')?.count).toBe(2);
  });

  it('reads tailwind theme values best-effort', () => {
    expect(byName.get('colors.primary.500')?.value).toBe('#6366f1');
    expect(byName.get('colors.primary.500')?.category).toBe('color');
    expect(byName.get('borderRadius.card')?.value).toBe('14px');
  });

  it('renders a DESIGN.md with the expected sections', () => {
    const md = renderDesignMarkdown(report, {
      projectName: 'fixture',
      toolVersion: '0.0.0',
      generatedAt: '2026-07-10T00:00:00.000Z',
    });
    expect(md).toContain('# DESIGN.md — fixture');
    expect(md).toContain('## Colors');
    expect(md).toContain('## Typography');
    expect(md).toContain('| `--brand` | `#4c9bff`');
    expect(md).toContain('## Usage');
    // Theme override column appears for themes that override colors.
    expect(md).toMatch(/\| Token \| Value \| dark \| ocean \|/);
  });
});
