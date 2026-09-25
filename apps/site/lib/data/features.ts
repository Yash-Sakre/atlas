/**
 * Structured content for the parts of Atlas that aren't CLI commands:
 * the dashboard views and the files written to `.atlas/`, for the landing page.
 * The docs describe the same things in prose — keep the two in step.
 */
import {
  Boxes,
  Eraser,
  Image,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ScanSearch,
  Signpost,
} from 'lucide-react';

export type DashboardView = {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  /** Screenshot pair in public/screenshots/ (`<shot>-light.webp` / `<shot>-dark.webp`). */
  shot: string;
  /** Marks views added after the initial release, so the site can badge them. */
  isNew?: boolean;
};

export const DASHBOARD_VIEWS: DashboardView[] = [
  {
    id: 'overview',
    shot: 'overview',
    name: 'Overview',
    icon: LayoutDashboard,
    desc: 'Project stats at a glance — asset counts, framework detection, most-used assets and the health of the codebase.',
  },
  {
    id: 'assets',
    shot: 'components',
    name: 'Assets',
    icon: Boxes,
    desc: 'Every component, hook, util, context, store and route in one searchable, filterable list.',
  },
  {
    id: 'detail',
    shot: 'hooks',
    name: 'Asset detail',
    icon: ScanSearch,
    desc: 'Props and parameters with resolved types, the generated description, and every location the asset is used.',
  },
  {
    id: 'routes',
    shot: 'routes',
    name: 'Routes',
    icon: Signpost,
    desc: 'The route table for React Router, TanStack Router and the Next.js app / pages routers — including data-router config arrays.',
  },
  {
    id: 'dead-code',
    shot: 'dead-code',
    name: 'Dead code',
    icon: Eraser,
    desc: 'Unused exports, orphan files and duplicate implementations, grouped so you can clean up in one pass.',
  },
  {
    id: 'dependencies',
    shot: 'dependencies',
    name: 'Dependencies',
    icon: Package,
    desc: 'Every npm package you declare, with the installed version, how many files import it, and a live update check from the registry.',
    isNew: true,
  },
  {
    id: 'static-assets',
    shot: 'assets',
    name: 'Static assets',
    icon: Image,
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
