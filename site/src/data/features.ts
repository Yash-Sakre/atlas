/**
 * Structured content for the parts of Atlas that aren't CLI commands:
 * the dashboard views, the files written to `.atlas/`, and config keys.
 * Kept as data so the landing page and the docs page never drift apart.
 */

export type DashboardView = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Marks views added after the initial release, so the site can badge them. */
  isNew?: boolean;
};

export const DASHBOARD_VIEWS: DashboardView[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: '📊',
    desc: 'Project stats at a glance — asset counts, framework detection, most-used assets and the health of the codebase.',
  },
  {
    id: 'assets',
    name: 'Assets',
    icon: '🧩',
    desc: 'Every component, hook, util, context, store and route in one searchable, filterable list.',
  },
  {
    id: 'detail',
    name: 'Asset detail',
    icon: '🔍',
    desc: 'Props and parameters with resolved types, the generated description, and every location the asset is used.',
  },
  {
    id: 'routes',
    name: 'Routes',
    icon: '🧭',
    desc: 'The route table for React Router, TanStack Router and the Next.js app / pages routers — including data-router config arrays.',
  },
  {
    id: 'tree',
    name: 'Dependency tree',
    icon: '🔗',
    desc: 'Walk the import / render / uses graph from any asset, in both directions.',
  },
  {
    id: 'dead-code',
    name: 'Dead code',
    icon: '🧹',
    desc: 'Unused exports, orphan files and duplicate implementations, grouped so you can clean up in one pass.',
  },
  {
    id: 'dependencies',
    name: 'Dependencies',
    icon: '📦',
    desc: 'Every npm package you declare, with the installed version, how many files import it, and a live update check from the registry.',
    isNew: true,
  },
  {
    id: 'static-assets',
    name: 'Static assets',
    icon: '🖼️',
    desc: 'Images, vectors, fonts, media and PDFs previewed from their real path on disk — with size, intrinsic dimensions, the URL public/ files are served at, and every reference from code, CSS and markup.',
    isNew: true,
  },
];

export type OutputFile = {
  file: string;
  desc: string;
  isNew?: boolean;
};

export const OUTPUT_FILES: OutputFile[] = [
  { file: 'components.json', desc: 'Every detected component with props, component kind and source location.' },
  { file: 'hooks.json', desc: 'Custom hooks with parameters, return shape and the hooks they call.' },
  { file: 'utils.json', desc: 'Utilities classified as function, validator, formatter, helper or constant.' },
  { file: 'contexts.json', desc: 'React contexts and state stores (Redux, Zustand, Jotai, MobX, …).' },
  { file: 'routes.json', desc: 'Routes resolved per router kind, with their components and path params.' },
  { file: 'graph.json', desc: 'The dependency graph — nodes plus imports / renders / uses / provides edges.' },
  { file: 'dead-code.json', desc: 'Unused exports, orphan files and duplicate candidates.' },
  { file: 'architecture.json', desc: 'Folder structure, module boundaries, the shared layer and boundary violations.' },
  { file: 'dependencies.json', desc: 'Declared npm packages with kind, resolved version, install source and import counts.', isNew: true },
  { file: 'static-assets.json', desc: 'Static files on disk with kind, size, dimensions, public URL and the places that reference them.', isNew: true },
  { file: 'search.json', desc: 'The prebuilt fuzzy-search index used by `atlas search` and the dashboard.' },
  { file: 'analysis.json', desc: 'The full snapshot every other command reads back from.' },
];

export type ConfigKey = {
  key: string;
  type: string;
  desc: string;
  default?: string;
};

export const CONFIG_KEYS: ConfigKey[] = [
  { key: 'include', type: 'string[]', desc: 'Globs to scan, relative to the project root.', default: '**/*.{ts,tsx,js,jsx,mjs,cjs}' },
  { key: 'exclude', type: 'string[]', desc: 'Globs to skip. Defaults already cover node_modules, build output, declaration files, tests and stories.' },
  { key: 'cache', type: 'boolean', desc: 'Enable the incremental cache. The cache is invalidated automatically when the Atlas version changes.', default: 'true' },
  { key: 'outDir', type: 'string', desc: 'Where analysis output and the cache are written, relative to the root.', default: '.atlas' },
  { key: 'sharedLayers', type: 'string[]', desc: 'Top-level folders to treat as the shared/common layer when checking module boundaries.' },
  { key: 'plugins', type: 'string[]', desc: 'Module paths of custom extractors to run alongside the built-in ones.' },
];

