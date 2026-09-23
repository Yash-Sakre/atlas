import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchRecords, splitWords } from '../src/search/searchIndex';
import type {
  ComponentAsset,
  ContextAsset,
  HookAsset,
  UtilAsset,
} from '../src/core/types';

describe('splitWords', () => {
  it('splits camelCase', () => {
    expect(splitWords('useInfiniteScroll')).toEqual(['use', 'infinite', 'scroll']);
    expect(splitWords('formatCurrency')).toEqual(['format', 'currency']);
  });

  it('splits PascalCase', () => {
    expect(splitWords('AuthProvider')).toEqual(['auth', 'provider']);
  });

  it('splits kebab and snake case', () => {
    expect(splitWords('use-debounce_value')).toEqual(['use', 'debounce', 'value']);
  });

  it('handles acronym runs', () => {
    expect(splitWords('HTMLParser')).toEqual(['html', 'parser']);
  });

  it('returns [] for empty input', () => {
    expect(splitWords('')).toEqual([]);
  });
});

/* --- minimal asset factories (only the fields the index reads) --- */

function baseFields(name: string, path: string) {
  return {
    id: `${path}#${name}`,
    name,
    path,
    exportType: 'named' as const,
    location: { filePath: path, line: 1, column: 0 },
    dependencies: [],
    usedIn: [],
    usageCount: 0,
    examples: [],
    tags: [] as string[],
  };
}

function component(name: string, path: string, tags: string[] = []): ComponentAsset {
  return {
    ...baseFields(name, path),
    type: 'component',
    tags,
    componentKind: 'function',
    props: [],
    defaultProps: {},
    rendersComponents: [],
  };
}

function hook(name: string, path: string, tags: string[] = []): HookAsset {
  return {
    ...baseFields(name, path),
    type: 'hook',
    tags,
    params: [],
    returnType: 'void',
    reactHooksUsed: [],
    callsHooks: [],
  };
}

function util(name: string, path: string, tags: string[] = []): UtilAsset {
  return {
    ...baseFields(name, path),
    type: 'utility',
    tags,
    utilKind: 'helper',
    params: [],
    returnType: 'void',
    isAsync: false,
    pure: true,
  };
}

function context(name: string, path: string, tags: string[] = []): ContextAsset {
  return {
    ...baseFields(name, path),
    type: 'context',
    tags,
    stateKind: 'react-context',
    stateShape: [],
  };
}

describe('buildSearchIndex', () => {
  it('produces one record per asset with derived keywords', () => {
    const records = buildSearchIndex([
      hook('useAuth', 'src/auth/hooks.ts', ['hook']),
    ]);
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.id).toBe('src/auth/hooks.ts#useAuth');
    // camelCase tokens, type, tag, and path segments all included
    expect(rec.keywords).toContain('use');
    expect(rec.keywords).toContain('auth');
    expect(rec.keywords).toContain('hook');
    expect(rec.keywords).toContain('hooks'); // path segment
  });

  it('prefers AI purpose over jsDoc for description', () => {
    const asset = util('groupBy', 'src/util.ts');
    asset.jsDoc = 'raw doc';
    asset.description = {
      purpose: 'AI purpose text',
      responsibilities: [],
      inputs: '',
      outputs: '',
      dependencies: [],
      whenToUse: '',
      whenNotToUse: '',
      commonUsage: '',
      examples: [],
      improvements: [],
      source: 'heuristic',
    };
    const [rec] = buildSearchIndex([asset]);
    expect(rec.description).toBe('AI purpose text');
  });
});

describe('searchRecords', () => {
  const assets = [
    hook('useAuth', 'src/auth/useAuth.ts', ['hook', 'auth']),
    context('AuthContext', 'src/auth/AuthContext.tsx', ['context', 'auth']),
    component('Button', 'src/ui/Button.tsx', ['component']),
    util('formatCurrency', 'src/format.ts', ['formatter']),
    component('LoginForm', 'src/auth/LoginForm.tsx', ['component']),
  ];
  const records = buildSearchIndex(assets);

  it('returns auth-related records first for query "auth"', () => {
    const results = searchRecords(records, 'auth');
    expect(results.length).toBeGreaterThan(0);
    const topTwo = results.slice(0, 2).map((r) => r.name);
    expect(topTwo).toContain('useAuth');
    expect(topTwo).toContain('AuthContext');
    // Button (no auth signal) should not lead the ranking
    expect(results[0].name).not.toBe('Button');
  });

  it('respects the limit', () => {
    expect(searchRecords(records, 'a', 2).length).toBeLessThanOrEqual(2);
  });

  it('returns [] for empty queries', () => {
    expect(searchRecords(records, '   ')).toEqual([]);
  });
});
