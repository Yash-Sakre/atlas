/** Dead-code / duplication analysis. */
import type {
  Asset,
  DeadCodeReport,
  DeadExport,
  DuplicateCandidate,
  ExtractionContext,
  RouteAsset,
} from '../core/types';

const ENTRY_BASENAMES = /(?:^|\/)(main|index|app|_app|_document|root|server|middleware)\.(t|j)sx?$/i;

export function analyzeDeadCode(assets: Asset[], routes: RouteAsset[], ctx: ExtractionContext): DeadCodeReport {
  const routeComponentNames = new Set(
    routes.map((r) => r.componentName).filter((n): n is string => Boolean(n)),
  );

  const isEntryFile = (path: string): boolean =>
    ENTRY_BASENAMES.test(path) ||
    /(?:^|\/)(?:src\/)?app\//.test(path) || // next app router file
    /(?:^|\/)(?:src\/)?pages\//.test(path); // next pages router file

  const isUnused = (a: Asset): boolean => {
    if (a.type === 'route') return false;
    if (a.exportType === 'none') return false; // internal, handled by orphan detection
    if (a.usageCount > 0) return false;
    if (routeComponentNames.has(a.name)) return false;
    if (isEntryFile(a.path)) return false;
    return true;
  };

  const toDead = (a: Asset): DeadExport => ({ id: a.id, name: a.name, path: a.path, type: a.type });

  const unused = assets.filter(isUnused);
  const unusedComponents = unused.filter((a) => a.type === 'component').map(toDead);
  const unusedHooks = unused.filter((a) => a.type === 'hook').map(toDead);
  const unusedUtils = unused.filter((a) => a.type === 'utility').map(toDead);
  const unusedContexts = unused
    .filter((a) => a.type === 'context' || a.type === 'store' || a.type === 'provider')
    .map(toDead);

  // Orphan files: every asset in the file is unused (and exported) and not an entry.
  const byFile = new Map<string, Asset[]>();
  for (const a of assets) {
    const arr = byFile.get(a.path) ?? [];
    arr.push(a);
    byFile.set(a.path, arr);
  }
  const orphanFiles: string[] = [];
  for (const [path, fileAssets] of byFile) {
    if (isEntryFile(path)) continue;
    const exported = fileAssets.filter((a) => a.exportType !== 'none' && a.type !== 'route');
    if (exported.length === 0) continue;
    if (exported.every((a) => a.usageCount === 0 && !routeComponentNames.has(a.name))) {
      orphanFiles.push(path);
    }
  }

  return {
    unusedComponents,
    unusedHooks,
    unusedUtils,
    unusedContexts,
    deadExports: unused.map(toDead),
    orphanFiles: orphanFiles.sort(),
    duplicateCandidates: findDuplicates(assets),
  };
}

/** Suspected duplicate functionality: same name across files, or identical util signatures. */
function findDuplicates(assets: Asset[]): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];

  // 1. Same (lowercased) name in different files.
  const byName = new Map<string, Asset[]>();
  for (const a of assets) {
    if (a.type === 'route') continue;
    const key = a.name.toLowerCase();
    const arr = byName.get(key) ?? [];
    arr.push(a);
    byName.set(key, arr);
  }
  for (const [, group] of byName) {
    const distinctFiles = new Set(group.map((g) => g.path));
    if (group.length > 1 && distinctFiles.size > 1) {
      out.push({
        ids: group.map((g) => g.id),
        names: [...new Set(group.map((g) => g.name))],
        reason: `Same name declared in ${distinctFiles.size} files`,
        similarity: 1,
      });
    }
  }

  // 2. Utilities with identical normalized signatures (likely copy-paste).
  const bySig = new Map<string, Asset[]>();
  for (const a of assets) {
    if (a.type !== 'utility') continue;
    const sig = normalizeSignature(a);
    if (!sig) continue;
    const arr = bySig.get(sig) ?? [];
    arr.push(a);
    bySig.set(sig, arr);
  }
  for (const [, group] of bySig) {
    const distinctFiles = new Set(group.map((g) => g.path));
    if (group.length > 1 && distinctFiles.size > 1) {
      out.push({
        ids: group.map((g) => g.id),
        names: [...new Set(group.map((g) => g.name))],
        reason: 'Identical utility signature (param + return types)',
        similarity: 0.9,
      });
    }
  }

  return out;
}

function normalizeSignature(a: Asset): string | null {
  if (a.type !== 'utility') return null;
  const params = a.params.map((p) => p.type).join(',');
  return `${params}=>${a.returnType}`;
}
