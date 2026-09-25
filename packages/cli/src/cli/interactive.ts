/**
 * `atlas` with no arguments in a terminal: a guided menu over every command, so
 * nobody has to remember flags. Each choice asks only for what it needs, then
 * runs the same command function the flag-based CLI uses.
 */
import { existsSync } from 'fs';
import * as path from 'path';
import { analyzeCommand } from './commands/analyze';
import { describeCommand } from './commands/describe';
import { serveCommand } from './commands/serve';
import { exportCommand } from './commands/exportSite';
import { graphCommand } from './commands/graph';
import { deadCodeCommand } from './commands/deadCode';
import { searchCommand } from './commands/search';
import { watchCommand } from './commands/watch';
import { detectAgents } from '../ai/agents';
import { answer, prompts } from '../utils/prompts';
import { pc } from '../utils/logger';

type Action = 'serve' | 'describe' | 'analyze' | 'search' | 'dead-code' | 'graph' | 'export' | 'watch';

export async function interactiveHome(version: string): Promise<void> {
  const p = await prompts();
  p.intro(`${pc.bgCyan(pc.black(' atlas '))} ${pc.dim(`v${version}`)}`);

  const root = await pickRoot();
  const agents = detectAgents();
  const aiHint = agents.length ? `via ${agents.map((a) => a.label).join(' / ')}` : 'no agent found — offline fallback';

  const action = await answer(
    p.select<Action>({
      message: 'What do you want to do?',
      options: [
        { value: 'serve', label: 'Open the dashboard', hint: 'analyze + browse in your browser' },
        { value: 'describe', label: 'Describe assets with AI', hint: aiHint },
        { value: 'analyze', label: 'Analyze', hint: `write JSON to .atlas/` },
        { value: 'search', label: 'Search assets' },
        { value: 'dead-code', label: 'Dead-code report' },
        { value: 'graph', label: 'Dependency graph' },
        { value: 'export', label: 'Export a static site', hint: 'hostable dashboard bundle' },
        { value: 'watch', label: 'Watch for changes', hint: 're-analyze on save' },
      ],
    }),
  );

  switch (action) {
    case 'serve': {
      const reanalyze = await answer(
        p.confirm({ message: 'Re-scan the codebase first?', initialValue: false }),
      );
      return serveCommand({ root, reanalyze });
    }
    case 'describe':
      return describeCommand({ root });
    case 'analyze': {
      await analyzeCommand({ root });
      const next = await answer(
        p.select<'describe' | 'serve' | 'done'>({
          message: 'Next?',
          options: [
            { value: 'describe', label: 'Improve descriptions with AI', hint: aiHint },
            { value: 'serve', label: 'Open the dashboard' },
            { value: 'done', label: 'Done' },
          ],
        }),
      );
      if (next === 'describe') return describeCommand({ root });
      if (next === 'serve') return serveCommand({ root, reanalyze: true });
      p.outro('Done.');
      return;
    }
    case 'search': {
      const query = await answer(
        p.text({
          message: 'Search for…',
          placeholder: 'e.g. authentication, modal, useFetch',
          validate: (v) => (v?.trim() ? undefined : 'Type something to search for'),
        }),
      );
      return searchCommand(query.trim(), { root });
    }
    case 'dead-code':
      return deadCodeCommand({ root });
    case 'graph':
      return graphCommand({ root });
    case 'export': {
      const outDir = await answer(
        p.text({
          message: 'Export to which folder? (outside the project)',
          initialValue: path.join(path.dirname(root), `${path.basename(root)}-atlas-site`),
          validate: (v) => {
            const out = path.resolve(v ?? '');
            return out === root || out.startsWith(root + path.sep)
              ? 'Pick a folder outside the scanned project'
              : undefined;
          },
        }),
      );
      return exportCommand({ root, outDir });
    }
    case 'watch':
      return watchCommand({ root });
  }
}

/** Confirm the project to scan — the cwd unless it clearly isn't a project. */
async function pickRoot(): Promise<string> {
  const p = await prompts();
  const cwd = process.cwd();
  const looksLikeProject = existsSync(path.join(cwd, 'package.json'));
  const input = await answer(
    p.text({
      message: 'Project to scan',
      initialValue: looksLikeProject ? '.' : '',
      placeholder: './path/to/app',
      validate: (v) => {
        if (!v?.trim()) return 'Enter a path';
        return existsSync(path.resolve(v.trim())) ? undefined : 'That folder does not exist';
      },
    }),
  );
  return path.resolve(input.trim());
}
