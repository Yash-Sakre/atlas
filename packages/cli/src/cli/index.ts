import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { describeCommand } from './commands/describe';
import { serveCommand } from './commands/serve';
import { exportCommand } from './commands/exportSite';
import { graphCommand } from './commands/graph';
import { deadCodeCommand } from './commands/deadCode';
import { searchCommand } from './commands/search';
import { watchCommand } from './commands/watch';
import { logger } from '../utils/logger';

export function buildCli(): Command {
  const program = new Command();

  program
    .name('atlas')
    .description('Atlas — discover, analyze & document reusable assets in a frontend codebase via AST semantics.')
    .version('0.1.0', '-v, --version');

  const rootOpt = (cmd: Command) =>
    cmd
      .option('-r, --root <dir>', 'project root to analyze', process.cwd())
      .option('-o, --out-dir <dir>', 'output directory (default .atlas)');

  // An optional positional path that overrides --root, so both `atlas serve ./app`
  // and `atlas serve --root ./app` work. Falls back to --root (default cwd).
  const pathArg = (cmd: Command) =>
    cmd.argument('[root]', 'project root to analyze (alternative to --root)');
  const rootOf = (rootArg: string | undefined, opts: { root: string }): string => rootArg ?? opts.root;

  pathArg(rootOpt(program.command('analyze')))
    .description('Scan the project and write the JSON analysis outputs')
    .option('--no-cache', 'disable the incremental cache')
    .action((rootArg, opts) =>
      run(() =>
        analyzeCommand({
          root: rootOf(rootArg, opts),
          noCache: opts.cache === false,
          outDir: opts.outDir,
        }),
      ),
    );

  pathArg(rootOpt(program.command('describe')))
    .description('Hand assets to a coding agent (claude/codex/cursor) for richer descriptions')
    .option('--agent <name>', 'agent to hand off to: claude | codex | cursor')
    .option('--apply', 'fold an agent\'s descriptions.json back into the analysis')
    .option('--heuristic', 'regenerate the offline heuristic descriptions instead')
    .option('--no-run', 'write the hand-off packet but do not invoke the agent')
    .option('--copy', 'copy the agent instruction to the clipboard for a manual paste')
    .option('--no-cache', 'disable the incremental cache')
    .action((rootArg, opts) =>
      run(() =>
        describeCommand({
          root: rootOf(rootArg, opts),
          outDir: opts.outDir,
          noCache: opts.cache === false,
          agent: opts.agent,
          apply: opts.apply,
          heuristic: opts.heuristic,
          run: opts.run,
          copy: opts.copy,
        }),
      ),
    );

  program
    .command('serve')
    .description('Analyze and serve the interactive React dashboard at a local link')
    .argument('[root]', 'project root to analyze (alternative to --root)')
    .option('-r, --root <dir>', 'project root to analyze', process.cwd())
    .option('-p, --port <n>', 'preferred port', '4321')
    .option('--no-open', 'do not open the browser automatically')
    .option('--reanalyze', 'ignore cached analysis and re-scan')
    .action((rootArg, opts) =>
      run(() =>
        serveCommand({ root: rootOf(rootArg, opts), port: opts.port, open: opts.open, reanalyze: opts.reanalyze }),
      ),
    );

  program
    .command('export')
    .description('Write a hostable static dashboard bundle (app + data.json) to an external folder')
    .argument('[root]', 'project root to analyze (alternative to --root)')
    .option('-r, --root <dir>', 'project root to analyze', process.cwd())
    .option('-o, --out-dir <dir>', 'destination folder (must be outside the project)')
    .option('--reanalyze', 'ignore cached analysis and re-scan')
    .action((rootArg, opts) =>
      run(() => exportCommand({ root: rootOf(rootArg, opts), outDir: opts.outDir, reanalyze: opts.reanalyze })),
    );

  pathArg(rootOpt(program.command('graph')))
    .description('Print the dependency graph (ASCII tree or --json)')
    .option('--json', 'output the graph as JSON')
    .action((rootArg, opts) => run(() => graphCommand({ root: rootOf(rootArg, opts), outDir: opts.outDir, json: opts.json })));

  pathArg(rootOpt(program.command('dead-code')))
    .description('Report unused exports, orphan files and duplicate candidates')
    .option('--json', 'output as JSON')
    .action((rootArg, opts) => run(() => deadCodeCommand({ root: rootOf(rootArg, opts), outDir: opts.outDir, json: opts.json })));

  rootOpt(program.command('search'))
    .description('Fuzzy-search discovered assets')
    .argument('<query>', 'search query, e.g. "authentication"')
    .option('--json', 'output as JSON')
    .option('-n, --limit <n>', 'max results', '20')
    .action((query, opts) =>
      run(() => searchCommand(query, { root: opts.root, outDir: opts.outDir, json: opts.json, limit: opts.limit })),
    );

  pathArg(rootOpt(program.command('watch')))
    .description('Re-analyze automatically on file changes')
    .action((rootArg, opts) => run(() => watchCommand({ root: rootOf(rootArg, opts), outDir: opts.outDir })));

  return program;
}

async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error((err as Error).stack ?? (err as Error).message);
    process.exitCode = 1;
  }
}
