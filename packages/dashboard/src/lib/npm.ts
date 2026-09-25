/**
 * Live npm registry enrichment for the Dependencies view.
 *
 * Atlas' analyzer only records the *declared* deps (offline). Everything richer
 * — description, latest published version, homepage/repo links, and whether an
 * update is available — is fetched lazily in the browser from the public npm
 * registry, so the data is always current and the analyzer stays network-free.
 */
import { useEffect, useRef, useState } from 'react';
import type { DependencyInfo, DependencySource } from '../types';

/**
 * Infer where a dependency resolves from its declared range — a fallback for
 * data produced before the analyzer recorded `source`. Only `registry` packages
 * have an npm page / version / update to check.
 */
export function classifySource(range: string): DependencySource {
  const r = (range || '').trim();
  if (/^(file:|link:|portal:)/.test(r)) return 'file';
  if (/^workspace:/.test(r)) return 'workspace';
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/.test(r)) return 'git';
  if (/^https?:\/\//.test(r)) {
    return /\.git($|#)|github\.com|gitlab\.com|bitbucket\.org/.test(r) ? 'git' : 'url';
  }
  if (/^[\w.-]+\/[\w.-]+(#.+)?$/.test(r)) return 'git';
  return 'registry';
}

/** Declared but neither imported nor run/configured as a tool. */
export function isUnusedDep(dep: DependencyInfo): boolean {
  return !(dep.usedInCount || 0) && !dep.toolingUse?.length;
}

const TOOLING_LABEL: Record<string, string> = {
  script: 'run from a package.json script',
  config: 'referenced by a tool config',
  types: 'type definitions for the compiler',
};

/** Human description of a package's non-import usage, e.g. "run from a package.json script". */
export function toolingLabel(dep: DependencyInfo): string {
  return (dep.toolingUse || []).map((u) => TOOLING_LABEL[u] ?? u).join(' · ');
}

/** Resolved source for a dependency (prefers the analyzer's value). */
export function sourceOf(dep: DependencyInfo): DependencySource {
  return dep.source ?? classifySource(dep.range);
}

/** Short human label for a non-registry source. */
export const SOURCE_LABEL: Record<DependencySource, string> = {
  registry: 'npm',
  file: 'local',
  git: 'git',
  workspace: 'workspace',
  url: 'url',
};

export interface NpmMeta {
  latest?: string;
  description?: string;
  homepage?: string;
  repoUrl?: string;
  license?: string;
  status: 'loading' | 'ok' | 'error';
}

const REGISTRY = 'https://registry.npmjs.org';
/** Module-level cache so revisiting the view doesn't refetch. */
const cache = new Map<string, NpmMeta>();
/** In-flight promises, deduped by package name. */
const inflight = new Map<string, Promise<NpmMeta>>();

/** "git+https://github.com/user/repo.git" → "https://github.com/user/repo". */
function normalizeRepo(repo: unknown): string | undefined {
  const raw = typeof repo === 'string' ? repo : (repo as { url?: string })?.url;
  if (!raw) return undefined;
  let url = raw
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/');
  if (url.startsWith('github:')) url = `https://github.com/${url.slice(7)}`;
  return url.startsWith('http') ? url : undefined;
}

async function fetchMeta(name: string): Promise<NpmMeta> {
  try {
    // The `/latest` endpoint returns just the newest version's manifest — small.
    const res = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}/latest`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const meta: NpmMeta = {
      status: 'ok',
      latest: json.version,
      description: json.description,
      homepage: typeof json.homepage === 'string' ? json.homepage : undefined,
      repoUrl: normalizeRepo(json.repository),
      license: typeof json.license === 'string' ? json.license : undefined,
    };
    return meta;
  } catch {
    return { status: 'error' };
  }
}

/**
 * Resolve npm metadata for a list of package names. Returns a map that fills in
 * as requests resolve; unresolved entries report `status: 'loading'`.
 */
export function useNpmRegistry(names: string[]): Record<string, NpmMeta> {
  const [, force] = useState(0);
  // Tracks whether this component is still mounted, so a resolving fetch only
  // re-renders live instances. A ref (not a per-fetch flag) survives React's
  // StrictMode mount → cleanup → remount cycle: otherwise the remount finds the
  // request already in flight, never attaches its own callback, and the view
  // stays stuck on "loading" until an unrelated re-render reads the cache.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const key = names.join(',');
  useEffect(() => {
    for (const name of names) {
      if (cache.has(name)) continue;
      let p = inflight.get(name);
      if (!p) {
        p = fetchMeta(name).then((meta) => {
          cache.set(name, meta);
          inflight.delete(name);
          return meta;
        });
        inflight.set(name, p);
      }
      // Attach a re-render on every mount, regardless of who started the fetch.
      void p.then(() => {
        if (mounted.current) force((n) => n + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const out: Record<string, NpmMeta> = {};
  for (const name of names) out[name] = cache.get(name) ?? { status: 'loading' };
  return out;
}

/** Extract a comparable [major, minor, patch] from a version or range string. */
function parseVersion(v?: string): [number, number, number] | null {
  if (!v) return null;
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** -1 if a<b, 0 if equal (on major.minor.patch), 1 if a>b. null if unknown. */
export function compareVersions(a?: string, b?: string): number | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** True when `latest` is strictly newer than the installed/declared version. */
export function isOutdated(current: string | undefined, latest: string | undefined): boolean {
  const cmp = compareVersions(current, latest);
  return cmp === -1;
}
