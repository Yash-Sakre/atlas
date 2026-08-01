/**
 * The docs information architecture: one entry per page, grouped for the
 * sidebar and kept flat for prev/next paging and search.
 *
 * `path` is the full route under the docs layout. Command pages are generated
 * from COMMANDS so a new CLI command shows up here automatically.
 */
import { COMMANDS } from './commands';

export type DocsEntry = {
  path: string;
  /** Sidebar label. */
  title: string;
  /** Short line shown in search results and on group index cards. */
  summary: string;
  /** Extra words to match on when searching. */
  keywords?: string;
  isNew?: boolean;
};

export type DocsGroup = {
  label: string;
  entries: DocsEntry[];
};

export const DOCS_GROUPS: DocsGroup[] = [
  {
    label: 'Getting started',
    entries: [
      {
        path: '/docs/getting-started',
        title: 'Quickstart',
        summary: 'From zero to a mapped codebase in one command.',
        keywords: 'intro tutorial walkthrough first run npx',
      },
      {
        path: '/docs/installation',
        title: 'Installation',
        summary: 'Run it with npx, or install the atlas binary globally.',
        keywords: 'npx npm install global binary requirements node',
      },
      {
        path: '/docs/configuration',
        title: 'Configuration',
        summary: 'Optional config file keys, and how monorepos are handled.',
        keywords: 'atlas.config.json atlasrc include exclude outDir monorepo workspace aliases',
      },
    ],
  },
  {
    label: 'CLI reference',
    entries: COMMANDS.map((c) => ({
      path: `/docs/cli/${c.id}`,
      title: c.name,
      summary: c.tagline,
      keywords: c.options.map((o) => o.flag).join(' '),
    })),
  },
  {
    label: 'Dashboard',
    entries: [
      {
        path: '/docs/dashboard',
        title: 'Views',
        summary: 'What each of the eight dashboard views shows you.',
        keywords:
          'overview assets detail routes tree dead code dependencies static assets images fonts media preview serve export',
        isNew: true,
      },
    ],
  },
  {
    label: 'Reference',
    entries: [
      {
        path: '/docs/outputs',
        title: 'Analysis outputs',
        summary: 'Every file written to .atlas/, and what it contains.',
        keywords: 'json analysis.json graph.json dead-code cache gitignore ci',
      },
      {
        path: '/docs/options',
        title: 'Global options',
        summary: 'Flags accepted by the root command and every subcommand.',
        keywords: 'version help root out-dir common flags',
      },
    ],
  },
];

/** All pages in sidebar order — used for prev/next paging and search. */
export const DOCS_FLAT: DocsEntry[] = DOCS_GROUPS.flatMap((g) => g.entries);

export function neighbors(path: string): { prev?: DocsEntry; next?: DocsEntry } {
  const i = DOCS_FLAT.findIndex((e) => e.path === path);
  if (i === -1) return {};
  return { prev: DOCS_FLAT[i - 1], next: DOCS_FLAT[i + 1] };
}
