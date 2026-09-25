/**
 * `atlas describe` (alias `atlas ai`) — have a coding agent (Claude Code /
 * Codex / Cursor) write richer descriptions than the offline heuristic can, then
 * fold them into the analysis so `atlas serve` shows them (each tagged with the
 * agent as its source).
 *
 *   atlas describe                  → in a terminal: pick an agent, scope and
 *                                     go. Elsewhere: print manual hand-off steps.
 *   atlas describe --agent claude   → run that agent now (batched, resumable).
 *   atlas describe --apply          → fold a hand-written descriptions.json in.
 *   atlas describe --heuristic      → (re)generate the offline descriptions.
 *   atlas describe --copy           → copy an agent instruction for a manual paste.
 */
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, type ConfigOverrides } from '../../core/config';
import { runAnalysis } from '../../core/analyzer';
import { writeJsonOutputs } from '../../output/writer';
import { buildSearchIndex } from '../../search/searchIndex';
import { allAssets, type AnalysisResult, type Asset, type ResolvedConfig } from '../../core/types';
import { cachedResultPath, projectCacheDir } from '../../serve/paths';
import { logger, pc } from '../../utils/logger';
import { spinnerHooks } from '../../utils/progress';
import { answer, isInteractive, prompts } from '../../utils/prompts';
import { describeAssets } from '../../ai/describe';
import { AGENTS, agentAvailable, detectAgents, isAgentId, manualCommand, type AgentId } from '../../ai/agents';
import {
  applyAnswers,
  handoffDir,
  readAnswers,
  writeHandoff,
  HANDOFF_FILES,
  type HandoffPaths,
} from '../../ai/handoff';
import { chunk, describeInBatches, DEFAULT_BATCH_SIZE, DEFAULT_CONCURRENCY } from '../../ai/batch';
import { copyToClipboard } from '../../utils/clipboard';
import { serveCommand } from './serve';

export interface DescribeFlags {
  root: string;
  outDir?: string;
  noCache?: boolean;
  agent?: string;
  apply?: boolean;
  heuristic?: boolean;
  run?: boolean;
  copy?: boolean;
  model?: string;
  /** Comma-separated asset kinds to describe, e.g. "component,hook". */
  only?: string;
  batchSize?: string;
  concurrency?: string;
  /** Re-describe assets that already have agent descriptions. */
  fresh?: boolean;
  /** Skip all confirmation prompts. */
  yes?: boolean;
}

type Engine = AgentId | 'heuristic' | 'copy';

/** Asset kinds offered in the scope picker, in display order. */
const KINDS: Array<{ value: string; label: string; match: (a: Asset) => boolean }> = [
  { value: 'component', label: 'Components', match: (a) => a.type === 'component' },
  { value: 'hook', label: 'Hooks', match: (a) => a.type === 'hook' },
  { value: 'utility', label: 'Utilities', match: (a) => a.type === 'utility' },
  {
    value: 'context',
    label: 'Contexts & stores',
    match: (a) => a.type === 'context' || a.type === 'store' || a.type === 'provider',
  },
  { value: 'route', label: 'Routes', match: (a) => a.type === 'route' },
];

/** Forgiving spellings accepted by `--only`. */
const KIND_ALIASES: Record<string, string> = {
  components: 'component',
  hooks: 'hook',
  util: 'utility',
  utils: 'utility',
  utilities: 'utility',
  contexts: 'context',
  store: 'context',
  stores: 'context',
  provider: 'context',
  providers: 'context',
  routes: 'route',
};

function normalizeKind(kind: string): string {
  const k = kind.trim().toLowerCase();
  return KIND_ALIASES[k] ?? k;
}

/** Rebuild derived data, then persist to `.atlas/` and the serve cache. */
function persist(result: AnalysisResult, config: ResolvedConfig): void {
  result.search = buildSearchIndex(allAssets(result));
  const { dir } = writeJsonOutputs(result, config.root, config.outDir);
  // Mirror into the dashboard cache so `atlas serve` reflects the new docs.
  mkdirSync(projectCacheDir(config.root), { recursive: true });
  writeFileSync(cachedResultPath(config.root), JSON.stringify(result), 'utf8');
  logger.success('Descriptions written to', dir);
}

/** Analyze the project (heuristic + any saved agent descriptions as a baseline). */
async function analyze(config: ResolvedConfig): Promise<AnalysisResult> {
  const spin = logger.spinner('Scanning & analyzing…');
  const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(spin) });
  spin(`Analyzed ${result.stats.fileCount} files in ${(result.stats.durationMs / 1000).toFixed(2)}s`);
  return result;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function describeCommand(flags: DescribeFlags): Promise<void> {
  const overrides: ConfigOverrides = { noCache: flags.noCache, outDir: flags.outDir };
  const config = loadConfig(flags.root, overrides);
  const dir = handoffDir(config.root, config.outDir);
  const answersFile = join(dir, HANDOFF_FILES.answers);
  const ask = isInteractive() && !flags.yes;

  logger.banner('atlas · describe');

  if (flags.agent && !isAgentId(flags.agent)) {
    logger.error(`Unknown agent "${flags.agent}". Choose one of: ${Object.keys(AGENTS).join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  // ── --apply: fold existing answers back in, no agent run. ──
  if (flags.apply) {
    if (!existsSync(answersFile)) {
      logger.error(`No agent output found at ${pc.cyan(answersFile)}.`);
      logger.step(`Run ${pc.cyan('atlas describe')} first, or write that file by hand.`);
      process.exitCode = 1;
      return;
    }
    const result = await analyze(config);
    const assets = allAssets(result);
    const source = flags.agent && isAgentId(flags.agent) ? flags.agent : 'claude';
    const applied = applyAnswers(assets, readAnswers(answersFile), source);
    logger.newline();
    logger.success('Assets described by agent', `${applied}/${assets.length}`);
    persist(result, config);
    return;
  }

  const result = await analyze(config);
  const assets = allAssets(result);
  logger.newline();

  // ── Pick the engine: flag → interactive picker → manual instructions. ──
  let engine: Engine | undefined = flags.heuristic
    ? 'heuristic'
    : (flags.agent as AgentId | undefined) ?? (flags.copy ? 'copy' : undefined);
  if (!engine && ask) engine = await pickEngine();

  if (!engine) {
    printManualHandoff(writeHandoff(dir, assets, 'your coding agent'), assets.length);
    return;
  }

  if (engine === 'heuristic') {
    for (const a of assets) a.description = undefined;
    await describeAssets(assets);
    // Park saved agent answers so re-analysis stops restoring them.
    if (existsSync(answersFile)) {
      renameSync(answersFile, `${answersFile}.bak`);
      logger.step(`Previous agent descriptions moved to ${pc.cyan(`${HANDOFF_FILES.answers}.bak`)}`);
    }
    logger.success('Assets described (heuristic)', assets.length);
    persist(result, config);
    return;
  }

  if (engine === 'copy') {
    copyInstruction(writeHandoff(dir, assets, 'your coding agent'));
    return;
  }

  const spec = AGENTS[engine];
  if (!agentAvailable(spec) || flags.run === false) {
    const packet = writeHandoff(dir, assets, spec.label);
    if (flags.run !== false) logger.warn(`${spec.label} (${pc.bold(spec.bin)}) was not found on your PATH.`);
    logger.step(`Run it yourself, then fold the result in:`);
    logger.raw(`  ${pc.cyan(manualCommand(spec, instructionFor(packet)))}`);
    logger.raw(`  ${pc.cyan('atlas describe --apply')}`);
    return;
  }

  // ── Scope: which asset kinds, and resume vs. start fresh. ──
  let kinds = flags.only ? flags.only.split(',').map(normalizeKind) : KINDS.map((k) => k.value);
  if (!flags.only && ask) kinds = await pickKinds(assets);
  const inScope = assets.filter((a) => KINDS.some((k) => kinds.includes(k.value) && k.match(a)));

  const saved = existsSync(answersFile) ? readAnswers(answersFile) : {};
  let fresh = Boolean(flags.fresh);
  const alreadyDone = inScope.filter((a) => saved[a.id]).length;
  if (!fresh && ask && alreadyDone > 0 && alreadyDone < inScope.length) {
    fresh = await pickFresh(alreadyDone, inScope.length);
  } else if (!fresh && ask && alreadyDone === inScope.length && inScope.length > 0) {
    const p = await prompts();
    fresh = await answer(
      p.confirm({ message: `All ${inScope.length} assets already have agent descriptions. Regenerate them?`, initialValue: false }),
    );
  }
  const pending = fresh ? inScope : inScope.filter((a) => !saved[a.id]);

  let model = flags.model;
  if (!model && ask && spec.id === 'claude' && pending.length) model = await pickClaudeModel();

  const batchSize = positiveInt(flags.batchSize, DEFAULT_BATCH_SIZE);
  const concurrency = positiveInt(flags.concurrency, DEFAULT_CONCURRENCY);
  const batches = chunk(pending, batchSize).length;

  if (pending.length && ask) {
    const p = await prompts();
    const go = await answer(
      p.confirm({
        message: `Describe ${pending.length} assets with ${spec.label}${model ? ` (${model})` : ''} — ${batches} batch${batches === 1 ? '' : 'es'}, ${concurrency} at a time?`,
      }),
    );
    if (!go) {
      p.cancel('Nothing sent to the agent.');
      return;
    }
  }

  if (pending.length) {
    mkdirSync(dir, { recursive: true });
    const onInterrupt = () => {
      logger.newline();
      logger.warn('Interrupted — finished batches are saved. Run the same command again to resume.');
      process.exit(130);
    };
    process.once('SIGINT', onInterrupt);

    const started = Date.now();
    const spin = logger.spinner(`Handing ${pending.length} assets to ${spec.label}…`);
    const run = await describeInBatches({
      spec,
      assets: pending,
      cwd: config.root,
      dir,
      answersFile,
      batchSize,
      concurrency,
      model,
      timeoutMs: 10 * 60_000,
      onProgress: (p) =>
        spin.update(
          `${spec.label} · batch ${p.batchesDone}/${p.batches} · ${p.described}/${p.total} described` +
            (p.failed ? pc.yellow(` · ${p.failed} failed`) : ''),
        ),
    });
    process.removeListener('SIGINT', onInterrupt);
    spin(`${spec.label} described ${run.described}/${run.total} assets in ${formatDuration(Date.now() - started)}`);

    if (run.failed) {
      logger.warn(`${run.failed} assets were not described (they keep their heuristic text).`);
      for (const e of run.errors) logger.step(e);
      logger.step(`Re-run ${pc.cyan('atlas describe')} to retry just those.`);
      process.exitCode = run.described ? 0 : 1;
    }
  } else {
    logger.success('Nothing to do', `all ${inScope.length} assets in scope already described`);
  }

  // Everything saved so far (this run + earlier ones) lands in the analysis.
  const applied = existsSync(answersFile) ? applyAnswers(assets, readAnswers(answersFile), spec.id) : 0;
  logger.success('Assets with agent descriptions', `${applied}/${assets.length}`);
  persist(result, config);

  if (ask && applied > 0) {
    const p = await prompts();
    const open = await answer(p.confirm({ message: 'Open the dashboard to see them?' }));
    if (open) await serveCommand({ root: config.root });
    else logger.step(`View them any time: ${pc.cyan('atlas serve')}`);
  } else {
    logger.step(`View them: ${pc.cyan('atlas serve')}`);
  }
}

/* ------------------------------ interactive ------------------------------- */

async function pickEngine(): Promise<Engine> {
  const p = await prompts();
  const installed = new Set(detectAgents().map((s) => s.id));
  const agentOptions = Object.values(AGENTS)
    .sort((a, b) => Number(installed.has(b.id)) - Number(installed.has(a.id)))
    .map((s) => ({
      value: s.id as Engine,
      label: s.label,
      hint: installed.has(s.id) ? 'installed' : `not found — install \`${s.bin}\``,
      disabled: !installed.has(s.id),
    }));
  return answer(
    p.select<Engine>({
      message: 'Who should write the descriptions?',
      initialValue: agentOptions.find((o) => !o.disabled)?.value ?? 'heuristic',
      options: [
        ...agentOptions,
        { value: 'heuristic', label: 'Offline heuristic', hint: 'instant, no AI' },
        { value: 'copy', label: 'Copy a prompt', hint: 'paste into any other agent or chat' },
      ],
    }),
  );
}

async function pickKinds(assets: Asset[]): Promise<string[]> {
  const p = await prompts();
  const options = KINDS.map((k) => ({ ...k, count: assets.filter(k.match).length }))
    .filter((k) => k.count > 0)
    .map((k) => ({ value: k.value, label: k.label, hint: String(k.count) }));
  return answer(
    p.multiselect<string>({
      message: 'Which assets should it describe?',
      options,
      initialValues: options.map((o) => o.value),
      required: true,
    }),
  );
}

async function pickFresh(done: number, total: number): Promise<boolean> {
  const p = await prompts();
  return answer(
    p.select<boolean>({
      message: `${done}/${total} assets already have agent descriptions.`,
      options: [
        { value: false, label: `Resume`, hint: `describe the remaining ${total - done}` },
        { value: true, label: 'Start fresh', hint: `re-describe all ${total}` },
      ],
    }),
  );
}

async function pickClaudeModel(): Promise<string | undefined> {
  const p = await prompts();
  const model = await answer(
    p.select<string>({
      message: 'Which Claude model?',
      options: [
        { value: '', label: 'Default', hint: 'your Claude Code setting' },
        { value: 'sonnet', label: 'Sonnet', hint: 'balanced' },
        { value: 'haiku', label: 'Haiku', hint: 'fastest, cheapest — good for large repos' },
        { value: 'opus', label: 'Opus', hint: 'most capable' },
      ],
    }),
  );
  return model || undefined;
}

/* -------------------------------- manual ---------------------------------- */

function instructionFor(packet: HandoffPaths): string {
  return (
    `Read ${packet.prompt} and follow it exactly. ` +
    `Use ${packet.assets} as input and write your JSON result to ${packet.answers}.`
  );
}

function printManualHandoff(packet: HandoffPaths, count: number): void {
  logger.success('Hand-off packet written', packet.dir);
  logger.table([
    ['Prompt', packet.prompt],
    ['Assets', `${count} → ${packet.assets}`],
    ['Agent writes', packet.answers],
  ]);
  logger.newline();
  const installed = detectAgents();
  logger.raw(pc.bold('Let Atlas drive an agent (batched, resumable):'));
  for (const s of Object.values(AGENTS)) {
    const mark = installed.includes(s) ? pc.green('●') : pc.dim('○');
    logger.raw(`  ${mark} ${pc.cyan(`atlas describe --agent ${s.id}`)}`);
  }
  logger.newline();
  logger.step(`Or hand it off yourself: ${pc.cyan(manualCommand(AGENTS.claude, instructionFor(packet)))}`);
  logger.step(`  then ${pc.cyan('atlas describe --apply')}`);
  logger.step(`Or skip the agent entirely: ${pc.cyan('atlas describe --heuristic')}`);
}

function copyInstruction(packet: HandoffPaths): void {
  const instruction = instructionFor(packet);
  if (copyToClipboard(instruction)) {
    logger.success('Copied the agent instruction to your clipboard');
    logger.step('Paste it into any agent (Claude/Codex/Cursor/chat), let it write the answers, then:');
  } else {
    logger.warn('Could not access a clipboard tool — copy the instruction below by hand:');
    logger.raw(`  ${pc.cyan(instruction)}`);
    logger.step('Then:');
  }
  logger.raw(`  ${pc.cyan('atlas describe --apply')}`);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
