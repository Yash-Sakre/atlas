export type CmdOption = {
  flag: string;
  desc: string;
  default?: string;
};

export type CmdExample = {
  cmd: string;
  note?: string;
};

export type Command = {
  id: string;
  name: string;
  signature: string;
  tagline: string;
  description: string;
  options: CmdOption[];
  examples: CmdExample[];
};

/** Options shared by most analysis commands (registered as `rootOpt` in the CLI). */
const COMMON_OPTIONS: CmdOption[] = [
  { flag: '-r, --root <dir>', desc: 'Project root to analyze. Also accepted as a positional path argument.', default: 'cwd' },
  { flag: '-o, --out-dir <dir>', desc: 'Directory for analysis output and cache.', default: '.atlas' },
];

export const GLOBAL_OPTIONS: CmdOption[] = [
  { flag: '-v, --version', desc: 'Print the installed Atlas version and exit.' },
  { flag: '-h, --help', desc: 'Show help for Atlas or any subcommand.' },
];

export const COMMANDS: Command[] = [
  {
    id: 'serve',
    name: 'atlas serve',
    signature: 'atlas serve [root] [options]',
    tagline: 'Analyze and open the interactive dashboard.',
    description:
      'The fastest way to explore a codebase. Atlas runs the full AST analysis (reusing the cache when it can), then starts a local server and opens the React dashboard — search, asset detail, props and params, usage locations, and the live dependency graph.',
    options: [
      { flag: '-r, --root <dir>', desc: 'Project root to analyze (or pass it positionally).', default: 'cwd' },
      { flag: '-p, --port <n>', desc: 'Preferred port; Atlas falls back to the next free one.', default: '4321' },
      { flag: '--no-open', desc: 'Start the server but do not open the browser automatically.' },
      { flag: '--reanalyze', desc: 'Ignore cached analysis and re-scan from scratch.' },
    ],
    examples: [
      { cmd: 'npx codebase-atlas serve', note: 'Analyze the current directory and open the dashboard.' },
      { cmd: 'atlas serve ./apps/web --port 3000' },
      { cmd: 'atlas serve --no-open --reanalyze', note: 'Force a fresh scan without launching a browser.' },
    ],
  },
  {
    id: 'analyze',
    name: 'atlas analyze',
    signature: 'atlas analyze [root] [options]',
    tagline: 'Scan the project and write JSON analysis output.',
    description:
      'Runs the AST pipeline and writes the structured analysis (assets, usage, graph, dead-code) to the output directory as JSON. Use it in CI, to diff results over time, or to feed other tools — nothing is served and nothing opens.',
    options: [
      ...COMMON_OPTIONS,
      { flag: '--no-cache', desc: 'Disable the incremental cache and analyze every file fresh.' },
    ],
    examples: [
      { cmd: 'atlas analyze', note: 'Write analysis JSON to .atlas/.' },
      { cmd: 'atlas analyze ./packages/ui --out-dir reports/ui' },
      { cmd: 'atlas analyze --no-cache' },
    ],
  },
  {
    id: 'serve-export',
    name: 'atlas export',
    signature: 'atlas export [root] [options]',
    tagline: 'Write a hostable static dashboard bundle.',
    description:
      'Produces a self-contained static build of the dashboard (the app plus a data.json snapshot) in an external folder. Deploy it to GitHub Pages, Netlify, S3, or any static host to share a read-only map of your codebase with the whole team.',
    options: [
      { flag: '-r, --root <dir>', desc: 'Project root to analyze (or pass it positionally).', default: 'cwd' },
      { flag: '-o, --out-dir <dir>', desc: 'Destination folder for the bundle. Must be outside the project.' },
      { flag: '--reanalyze', desc: 'Ignore cached analysis and re-scan before exporting.' },
    ],
    examples: [
      { cmd: 'atlas export --out-dir ../atlas-site' },
      { cmd: 'atlas export ./apps/web -o /tmp/web-atlas --reanalyze' },
    ],
  },
  {
    id: 'graph',
    name: 'atlas graph',
    signature: 'atlas graph [root] [options]',
    tagline: 'Print the dependency graph.',
    description:
      'Renders how assets depend on one another. By default it prints a readable ASCII tree to the terminal; pass --json to emit the raw graph for piping into other tooling or your own visualizations.',
    options: [
      ...COMMON_OPTIONS,
      { flag: '--json', desc: 'Output the graph as JSON instead of an ASCII tree.' },
    ],
    examples: [
      { cmd: 'atlas graph', note: 'Print the dependency tree.' },
      { cmd: 'atlas graph --json > graph.json' },
    ],
  },
  {
    id: 'dead-code',
    name: 'atlas dead-code',
    signature: 'atlas dead-code [root] [options]',
    tagline: 'Find unused exports, orphans and duplicates.',
    description:
      'Reports exports nothing imports, files no one references, and likely duplicate implementations — the three biggest sources of bloat in a frontend. Great as a pre-cleanup pass or a CI gate with --json.',
    options: [
      ...COMMON_OPTIONS,
      { flag: '--json', desc: 'Output the report as JSON instead of a formatted table.' },
    ],
    examples: [
      { cmd: 'atlas dead-code' },
      { cmd: 'atlas dead-code --json', note: 'Machine-readable output for CI.' },
    ],
  },
  {
    id: 'search',
    name: 'atlas search',
    signature: 'atlas search <query> [options]',
    tagline: 'Fuzzy-search every discovered asset.',
    description:
      'Searches across all detected components, hooks, utilities, contexts, stores and routes by name, path and signature. Find out whether something already exists before you build it again.',
    options: [
      { flag: '-r, --root <dir>', desc: 'Project root to search.', default: 'cwd' },
      { flag: '-o, --out-dir <dir>', desc: 'Directory containing analysis output.', default: '.atlas' },
      { flag: '-n, --limit <n>', desc: 'Maximum number of results to return.', default: '20' },
      { flag: '--json', desc: 'Output matches as JSON.' },
    ],
    examples: [
      { cmd: 'atlas search authentication' },
      { cmd: 'atlas search "format date" --limit 5' },
    ],
  },
  {
    id: 'describe',
    name: 'atlas describe',
    signature: 'atlas describe [root] [options]',
    tagline: 'Generate richer docs — with or without an AI agent.',
    description:
      'Atlas writes accurate, offline descriptions for every asset by default. Run describe to regenerate them, or hand the assets (with their AST context) to a coding agent like Claude, Codex or Cursor for richer prose, then fold the results back into the analysis.',
    options: [
      { flag: '--agent <name>', desc: 'Agent to hand off to: claude | codex | cursor.' },
      { flag: '--apply', desc: "Fold an agent's descriptions.json back into the analysis." },
      { flag: '--heuristic', desc: 'Regenerate the offline heuristic descriptions instead of using an agent.' },
      { flag: '--no-run', desc: 'Write the hand-off packet but do not invoke the agent.' },
      { flag: '--copy', desc: 'Copy the agent instruction to the clipboard for a manual paste.' },
      { flag: '--no-cache', desc: 'Disable the incremental cache.' },
      ...COMMON_OPTIONS,
    ],
    examples: [
      { cmd: 'atlas describe --heuristic', note: 'Regenerate offline descriptions, no network.' },
      { cmd: 'atlas describe --agent claude' },
      { cmd: 'atlas describe --agent claude --apply', note: 'Fold the agent output back in.' },
    ],
  },
  {
    id: 'watch',
    name: 'atlas watch',
    signature: 'atlas watch [root] [options]',
    tagline: 'Re-analyze automatically on file changes.',
    description:
      'Watches the project and incrementally re-runs analysis whenever files change, keeping the cache and any served dashboard up to date as you work.',
    options: [...COMMON_OPTIONS],
    examples: [
      { cmd: 'atlas watch' },
      { cmd: 'atlas watch ./apps/web' },
    ],
  },
];
