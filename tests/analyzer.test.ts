import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { loadConfig } from '../src/core/config';
import { runAnalysis } from '../src/core/analyzer';
import type { AnalysisResult } from '../src/core/types';

const FIXTURE = join(__dirname, '..', 'examples', 'sample-app');

/**
 * Integration test: runs the full pipeline on the fixture and locks in the
 * semantic detection behaviour (path-independent classification, usage, dead
 * code). Uses the heuristic AI provider so it runs fully offline.
 */
describe('runAnalysis (integration)', () => {
  let result: AnalysisResult;

  beforeAll(async () => {
    const config = loadConfig(FIXTURE, { ai: 'none', noCache: true });
    result = await runAnalysis(config, { skipDocs: false });
  }, 30_000);

  it('detects every component kind regardless of file name', () => {
    const byName = new Map(result.components.map((c) => [c.name, c]));
    expect(byName.get('TextInput')?.componentKind).toBe('forwardRef');
    expect(byName.get('Badge')?.componentKind).toBe('memo');
    expect(byName.get('Avatar')?.componentKind).toBe('arrow');
    expect(byName.get('Button')?.componentKind).toBe('function');
    // Avatar lives in stuff.tsx and is a *default* export resolved post-hoc.
    expect(byName.get('Avatar')?.exportType).toBe('default');
  });

  it('extracts Button props from its interface', () => {
    const button = result.components.find((c) => c.name === 'Button');
    expect(button).toBeDefined();
    const propNames = button!.props.map((p) => p.name);
    expect(propNames).toContain('variant');
    expect(propNames).toContain('loading');
  });

  it('detects hooks but not the like-named component', () => {
    const hookNames = result.hooks.map((h) => h.name).sort();
    expect(hookNames).toEqual(['useAuth', 'useDebounce', 'useInfiniteScroll']);
  });

  it('classifies utilities by signature, not folder', () => {
    const byName = new Map(result.utils.map((u) => [u.name, u]));
    expect(byName.get('isEmail')?.utilKind).toBe('validator');
    expect(byName.get('formatCurrency')?.utilKind).toBe('formatter');
    expect(byName.get('groupBy')?.utilKind).toBe('helper');
  });

  it('detects context + zustand store with state shape', () => {
    const kinds = result.contexts.map((c) => c.stateKind);
    expect(kinds).toContain('react-context');
    expect(kinds).toContain('zustand');
    const store = result.contexts.find((c) => c.stateKind === 'zustand');
    expect(store!.stateShape).toContain('addItem');
  });

  it('detects react-router routes with component names', () => {
    const paths = result.routes.map((r) => r.routePath);
    expect(paths).toContain('/');
    expect(paths).toContain('/login');
    expect(result.routes.every((r) => r.router === 'react-router')).toBe(true);
  });

  it('computes cross-file usage counts', () => {
    const button = result.components.find((c) => c.name === 'Button')!;
    expect(button.usageCount).toBeGreaterThan(0);
    expect(button.usedIn.some((u) => u.kind === 'jsx')).toBe(true);
  });

  it('flags dead code: unused component + util + orphan files', () => {
    const dc = result.deadCode;
    expect(dc.unusedComponents.map((c) => c.name)).toContain('PromoBanner');
    expect(dc.unusedUtils.map((u) => u.name)).toContain('slugify');
    expect(dc.orphanFiles).toContain('src/orphan-banner.tsx');
  });

  it('produces an offline heuristic description for every asset', () => {
    const all = [...result.components, ...result.hooks, ...result.utils];
    expect(all.every((a) => a.description?.source === 'heuristic')).toBe(true);
    expect(all.every((a) => a.description!.purpose.length > 0)).toBe(true);
  });

  it('builds a non-empty graph and search index', () => {
    expect(result.graph.nodes.length).toBeGreaterThan(10);
    expect(result.graph.edges.length).toBeGreaterThan(0);
    expect(result.search.length).toBeGreaterThan(10);
  });
});
