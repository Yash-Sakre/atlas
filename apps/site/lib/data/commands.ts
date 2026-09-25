/**
 * The CLI commands, as the landing page's quick-start grid lists them. Each
 * `id` is also the slug of the command's page under /docs/cli.
 */
export type Command = {
  id: string;
  name: string;
  tagline: string;
};

export const COMMANDS: Command[] = [
  { id: 'serve', name: 'atlas serve', tagline: 'Analyze and open the interactive dashboard.' },
  { id: 'analyze', name: 'atlas analyze', tagline: 'Scan the project and write JSON analysis output.' },
  { id: 'export', name: 'atlas export', tagline: 'Write a hostable static dashboard bundle.' },
  { id: 'graph', name: 'atlas graph', tagline: 'Print the dependency graph.' },
  { id: 'dead-code', name: 'atlas dead-code', tagline: 'Find unused exports, orphans and duplicates.' },
  { id: 'search', name: 'atlas search', tagline: 'Fuzzy-search every discovered asset.' },
  { id: 'describe', name: 'atlas ai', tagline: 'Let Claude Code, Codex or Cursor describe every asset.' },
  { id: 'watch', name: 'atlas watch', tagline: 'Re-analyze automatically on file changes.' },
];
