/** The sidebar / command-menu page list — one source for both. */
import {
  Browsers,
  Cube,
  FileDashed,
  Function as FunctionIcon,
  Graph,
  Image,
  Lightning,
  Package,
  SquaresFour,
  TreeStructure,
  type Icon,
} from '@phosphor-icons/react';
import type { Stats } from './types';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  count?: keyof Stats;
  /** Extra words the command menu matches on. */
  keywords?: string[];
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Browse',
    items: [
      { to: '/', label: 'Overview', icon: SquaresFour, keywords: ['home', 'dashboard'] },
      { to: '/components', label: 'Components', icon: Cube, count: 'components' },
      { to: '/hooks', label: 'Hooks', icon: Lightning, count: 'hooks' },
      { to: '/utils', label: 'Utils', icon: FunctionIcon, count: 'utils', keywords: ['functions'] },
      { to: '/contexts', label: 'Contexts', icon: Graph, count: 'contexts', keywords: ['stores', 'providers', 'state'] },
      { to: '/routes', label: 'Routes', icon: TreeStructure, count: 'routes', keywords: ['pages'] },
    ],
  },
  {
    label: 'Health',
    items: [
      { to: '/assets', label: 'Assets', icon: Image, count: 'staticAssets', keywords: ['images', 'fonts', 'media'] },
      { to: '/dependencies', label: 'Dependencies', icon: Package, count: 'dependencies', keywords: ['npm', 'packages'] },
      { to: '/dead-code', label: 'Dead code', icon: FileDashed, count: 'unusedExports', keywords: ['unused', 'orphans', 'duplicates'] },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Icon for a page path, for breadcrumbs and the mobile bar. */
export function navFor(pathname: string): NavItem {
  return NAV.find((n) => n.to === pathname) ?? { to: pathname, label: 'Atlas', icon: Browsers };
}

export const DOCS_URL = 'https://yash-sakre.github.io/atlas/docs/';
export const REPO_URL = 'https://github.com/Yash-Sakre/atlas';
