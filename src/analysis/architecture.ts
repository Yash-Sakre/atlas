/** Architecture insights: folder tree, module breakdown, layering violations. */
import type {
  Asset,
  ArchitectureInsights,
  ArchitectureViolation,
  FolderNode,
  ModuleInfo,
  ResolvedConfig,
} from '../core/types';

export function analyzeArchitecture(assets: Asset[], config: ResolvedConfig): ArchitectureInsights {
  const folderStructure = buildFolderTree(assets);
  const moduleOf = makeModuleResolver();
  const byId = new Map(assets.map((a) => [a.id, a]));

  // group assets by module
  const moduleAssets = new Map<string, Asset[]>();
  for (const a of assets) {
    const m = moduleOf(a.path);
    const arr = moduleAssets.get(m) ?? [];
    arr.push(a);
    moduleAssets.set(m, arr);
  }

  const isShared = (m: string): boolean =>
    config.sharedLayers.some((s) => m.toLowerCase() === s.toLowerCase());

  // module dependency edges
  const moduleDeps = new Map<string, Set<string>>();
  const violations: ArchitectureViolation[] = [];
  const violationSeen = new Set<string>();

  for (const a of assets) {
    const from = moduleOf(a.path);
    for (const depId of a.dependencies) {
      const dep = byId.get(depId);
      if (!dep) continue;
      const to = moduleOf(dep.path);
      if (from === to) continue;
      (moduleDeps.get(from) ?? moduleDeps.set(from, new Set()).get(from)!).add(to);

      const key = `${from}->${to}`;
      if (violationSeen.has(key)) continue;

      if (isShared(from) && !isShared(to)) {
        violationSeen.add(key);
        violations.push({
          from,
          to,
          message: `Shared layer "${from}" depends on feature module "${to}".`,
          recommendation: `Shared/common code must not depend on feature modules. Invert the dependency or move "${to}"'s needed pieces into the shared layer.`,
          severity: 'error',
        });
      } else if (!isShared(from) && !isShared(to)) {
        violationSeen.add(key);
        violations.push({
          from,
          to,
          message: `${capitalize(from)} imports ${capitalize(to)} module directly.`,
          recommendation: `Move shared logic into a common layer (one of: ${config.sharedLayers.join(', ')}) instead of coupling feature modules.`,
          severity: 'warning',
        });
      }
    }
  }

  const modules: ModuleInfo[] = [...moduleAssets.entries()]
    .map(([name, list]) => ({
      name,
      path: name,
      assetCount: list.length,
      dependsOn: [...(moduleDeps.get(name) ?? [])].sort(),
    }))
    .sort((a, b) => b.assetCount - a.assetCount);

  const sharedLayer = modules.filter((m) => isShared(m.name)).map((m) => m.name);

  return { folderStructure, modules, sharedLayer, violations };
}

/** First path segment (after an optional leading `src/`) is the module. */
function makeModuleResolver(): (path: string) => string {
  return (path: string) => {
    const parts = path.replace(/^\.\//, '').split('/');
    if (parts[0] === 'src' && parts.length > 1) parts.shift();
    if (parts.length <= 1) return '(root)';
    return parts[0];
  };
}

function buildFolderTree(assets: Asset[]): FolderNode {
  const root: FolderNode = { name: '.', path: '', fileCount: 0, assetCount: 0, children: [] };
  const fileSeen = new Map<string, Set<string>>(); // folderPath → files counted

  for (const a of assets) {
    const parts = a.path.split('/');
    const fileName = parts.pop()!;
    let node = root;
    let acc = '';
    node.assetCount++;
    countFile(fileSeen, '', a.path, root);
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: acc, fileCount: 0, assetCount: 0, children: [] };
        node.children.push(child);
      }
      child.assetCount++;
      countFile(fileSeen, acc, a.path, child);
      node = child;
    }
  }

  sortTree(root);
  return root;
}

function countFile(seen: Map<string, Set<string>>, folder: string, filePath: string, node: FolderNode): void {
  const set = seen.get(folder) ?? new Set<string>();
  if (!set.has(filePath)) {
    set.add(filePath);
    seen.set(folder, set);
    node.fileCount++;
  }
}

function sortTree(node: FolderNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  node.children.forEach(sortTree);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
