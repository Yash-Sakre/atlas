import { describe, it, expect } from 'vitest';
import { Project, type SourceFile } from 'ts-morph';
import { UtilExtractor } from '../src/extractors/utilExtractor';
import type { ExtractionContext, UtilAsset } from '../src/core/types';

function ctxFor(): ExtractionContext {
  return {
    root: '/proj',
    workspaceOf: () => undefined,
    frameworkOf: () => ({
      next: false,
      nextRouter: 'none',
      vite: true,
      reactRouter: false,
      tanstackRouter: false,
      react: true,
      stateLibs: [],
    }),
  } as unknown as ExtractionContext;
}

function utils(code: string): UtilAsset[] {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } });
  const sf: SourceFile = project.createSourceFile('/proj/src/u.ts', code);
  return new UtilExtractor().extract(sf, ctxFor());
}

describe('UtilExtractor — classification', () => {
  it('classifies a boolean-returning function as a validator even without a predicate name', () => {
    const [u] = utils('export function evenNumber(n: number): boolean { return n % 2 === 0; }');
    expect(u.utilKind).toBe('validator');
  });

  it('still classifies predicate-named functions as validators', () => {
    const [u] = utils('export function isEmail(s: string) { return /@/.test(s); }');
    expect(u.utilKind).toBe('validator');
  });

  it('does not flag impurity for a member access matching a side-effect token', () => {
    // `state.window` / `obj.fetch` are not the global APIs and must not break purity.
    const [u] = utils('export function pick(state: any) { return state.window + state.fetch; }');
    expect(u.tags).toContain('pure');
  });

  it('flags impurity for a real global side-effect call', () => {
    const [u] = utils('export function read() { return window.localStorage.getItem("k"); }');
    expect(u.tags).not.toContain('pure');
  });
});

describe('ast-utils location', () => {
  it('reports a real column (offset within the line), not the file offset of the line', () => {
    // Long preamble so the line's start offset is large (>100). The declaration
    // is indented 4 spaces, so the column must be ~4 — the old bug reported the
    // line-start file offset (~100+) instead.
    const filler = 'const filler = 123;\n'.repeat(10); // ~200 chars
    const [u] = utils(`${filler}    export function foo() { return 1; }`);
    expect(u.location.line).toBe(11);
    expect(u.location.column).toBe(4);
  });
});
