import Fuse from 'fuse.js';
import type {
  Asset,
  ComponentAsset,
  ContextAsset,
  HookAsset,
  SearchRecord,
  UtilAsset,
} from '../core/types';

/**
 * Split an identifier into lowercase word tokens.
 *
 * Handles camelCase, PascalCase, kebab-case, snake_case, and
 * "acronym runs" (e.g. `HTMLParser` -> `html`, `parser`).
 *
 *   splitWords('useInfiniteScroll') -> ['use', 'infinite', 'scroll']
 *   splitWords('formatCurrency')    -> ['format', 'currency']
 *   splitWords('AuthProvider')      -> ['auth', 'provider']
 */
export function splitWords(name: string): string[] {
  if (!name) return [];
  return name
    // boundary between an acronym run and a following Capitalized word: HTMLParser -> HTML Parser
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // boundary between lower/digit and an uppercase letter: fooBar -> foo Bar
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // treat kebab/snake/dots/whitespace as separators
    .split(/[\s\-_.]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
}

function propNames(asset: Asset): string[] {
  switch (asset.type) {
    case 'component':
      return (asset as ComponentAsset).props.map((p) => p.name);
    case 'hook':
      return (asset as HookAsset).params.map((p) => p.name);
    case 'utility':
      return (asset as UtilAsset).params.map((p) => p.name);
    case 'context':
    case 'store':
    case 'provider':
      return (asset as ContextAsset).stateShape;
    default:
      return [];
  }
}

function pathSegments(path: string): string[] {
  return path
    .split(/[\\/]/)
    .flatMap((seg) => seg.replace(/\.[^.]+$/, '')) // drop file extension
    .flatMap((seg) => splitWords(seg));
}

/** Description text for a record: AI purpose, else raw JSDoc, else empty. */
function descriptionOf(asset: Asset): string {
  return asset.description?.purpose ?? asset.jsDoc ?? '';
}

/** Build a flat, search-friendly record for a single asset. */
function toRecord(asset: Asset): SearchRecord {
  const keywords = new Set<string>();
  for (const w of splitWords(asset.name)) keywords.add(w);
  for (const t of asset.tags) keywords.add(t.toLowerCase());
  for (const p of propNames(asset)) {
    for (const w of splitWords(p)) keywords.add(w);
  }
  for (const seg of pathSegments(asset.path)) keywords.add(seg);
  keywords.add(asset.type);

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    path: asset.path,
    description: descriptionOf(asset),
    tags: asset.tags,
    keywords: [...keywords],
  };
}

/** Build flat search records from all assets in a result. */
export function buildSearchIndex(assets: Asset[]): SearchRecord[] {
  return assets.map(toRecord);
}

const FUSE_OPTIONS: import('fuse.js').IFuseOptions<SearchRecord> = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'keywords', weight: 0.25 },
    { name: 'tags', weight: 0.15 },
    { name: 'description', weight: 0.1 },
  ],
};

/** Query the records with Fuse.js fuzzy search. Returns ranked records. */
export function searchRecords(
  records: SearchRecord[],
  query: string,
  limit = 20,
): SearchRecord[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const fuse = new Fuse(records, FUSE_OPTIONS);
  return fuse
    .search(trimmed, { limit })
    .map((result) => result.item);
}
