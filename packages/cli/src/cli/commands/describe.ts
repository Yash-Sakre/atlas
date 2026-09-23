/**
 * `atlas describe` — hand every discovered asset off to a coding agent
 * (Claude Code / Codex / Cursor) for a richer description than the offline
 * heuristic can produce, then fold the agent's answers back into the analysis so
 * `atlas serve` shows them (each tagged with the agent as its source).
 *
 * Three ways to drive it:
 *   atlas describe                  → write the hand-off packet + print the
 *                                     command for each detected agent (manual).
 *   atlas describe --agent claude   → auto-run that agent, then apply its answers.
 *   atlas describe --apply          → fold an agent's descriptions.json back in.
 *   atlas describe --heuristic      → (re)generate the offline descriptions.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, type ConfigOverrides } from '../../core/config';
import { runAnalysis } from '../../core/analyzer';
import { writeJsonOutputs } from '../../output/writer';
import { buildSearchIndex } from '../../search/searchIndex';
import { allAssets, type AnalysisResult, type ResolvedConfig } from '../../core/types';
import { cachedResultPath, projectCacheDir } from '../../serve/paths';
import { logger, pc } from '../../utils/logger';
import { spinnerHooks } from '../../utils/progress';
import { describeAssets } from '../../ai/describe';
import {
  AGENTS,
  agentAvailable,
  detectAgents,
  isAgentId,
  manualCommand,
  runAgent,
  type AgentSpec,
} from '../../ai/agents';
import { applyAnswers, readAnswers, writeHandoff, HANDOFF_FILES } from '../../ai/handoff';
import { copyToClipboard } from '../../utils/clipboard';

export interface DescribeFlags {
  root: string;
  outDir?: string;
  noCache?: boolean;
  agent?: string;
  apply?: boolean;
  heuristic?: boolean;
  run?: boolean;
  copy?: boolean;
}

/** Compute the hand-off packet directory under the project's output dir. */
function handoffDir(config: ResolvedConfig): string {
  return join(config.root, config.outDir, 'handoff');
}

/** Rebuild derived data, then persist to `.atlas/` and the serve cache. */
function persist(result: AnalysisResult, config: ResolvedConfig): void {
  result.search = buildSearchIndex(allAssets(result));
  const { dir } = writeJsonOutputs(result, config.root, config.outDir);
  // Mirror into the dashboard cache so `atlas serve` reflects the new docs.
  mkdirSync(projectCacheDir(config.root), { recursive: true });
  writeFileSync(cachedResultPath(config.root), JSON.stringify(result), 'utf8');
  logger.success('Descriptions written to', dir);
  logger.step(`View them: ${pc.cyan('atlas serve')}`);
}

/** Analyze the project (heuristic descriptions included as a baseline). */
async function analyze(config: ResolvedConfig): Promise<AnalysisResult> {
  const spin = logger.spinner('Scanning & analyzing…');
  const result = await runAnalysis(config, { skipDocs: false, ...spinnerHooks(spin) });
  spin(`Analyzed ${result.stats.fileCount} files in ${(result.stats.durationMs / 1000).toFixed(2)}s`);
  return result;
}

export async function describeCommand(flags: DescribeFlags): Promise<void> {
  const overrides: ConfigOverrides = { noCache: flags.noCache, outDir: flags.outDir };
  const config = loadConfig(flags.root, overrides);
  const dir = handoffDir(config);

  logger.banner('atlas · describe');

  // ── Mode: --apply — fold an agent's existing answers back in, no re-run. ──
  if (flags.apply) {
    const answersFile = join(dir, HANDOFF_FILES.answers);
    if (!existsSync(answersFile)) {
      logger.error(`No agent output found at ${pc.cyan(answersFile)}.`);
      logger.step(`Run ${pc.cyan('atlas describe --agent <claude|codex|cursor>')} first, or write that file by hand.`);
      process.exitCode = 1;
      return;
    }
    const result = await analyze(config);
    const assets = allAssets(result);
    const answers = readAnswers(answersFile);
    const source = inferSourceFromAnswers(flags.agent);
    const applied = applyAnswers(assets, answers, source);
    logger.newline();
    logger.success('Assets described by agent', `${applied}/${assets.length}`);
    persist(result, config);
    return;
  }

  // ── Mode: --heuristic — (re)generate the offline descriptions. ──
  if (flags.heuristic) {
    const result = await analyze(config);
    const assets = allAssets(result);
    for (const a of assets) a.description = undefined;
    await describeAssets(assets);
    logger.newline();
    logger.success('Assets described (heuristic)', assets.length);
    persist(result, config);
    return;
  }

  // ── Agent hand-off (default + --agent). Analyze, then write the packet. ──
  const result = await analyze(config);
  const assets = allAssets(result);

  // Resolve the requested agent, if any.
  let spec: AgentSpec | undefined;
  if (flags.agent) {
    if (!isAgentId(flags.agent)) {
      logger.error(`Unknown agent "${flags.agent}". Choose one of: ${Object.keys(AGENTS).join(', ')}.`);
      process.exitCode = 1;
      return;
    }
    spec = AGENTS[flags.agent];
  }

  const packet = writeHandoff(dir, assets, spec?.label ?? 'your coding agent');
  logger.newline();
  logger.success('Hand-off packet written', packet.dir);
  logger.table([
    ['Prompt', packet.prompt],
    ['Assets', `${assets.length} → ${packet.assets}`],
    ['Agent writes', packet.answers],
  ]);
  logger.newline();

  const instruction =
    `Read ${packet.prompt} and follow it exactly. ` +
    `Use ${packet.assets} as input and write your JSON result to ${packet.answers}.`;

  // ── --copy: put the instruction on the clipboard for a manual paste. ──
  if (flags.copy) {
    if (copyToClipboard(instruction)) {
      logger.success('Copied the agent instruction to your clipboard');
      logger.step('Paste it into any agent (Claude/Codex/Cursor/chat), let it write the answers, then:');
      logger.raw(`  ${pc.cyan('atlas describe --apply')}`);
    } else {
      logger.warn('Could not access a clipboard tool — copy the instruction below by hand:');
      logger.raw(`  ${pc.cyan(instruction)}`);
    }
    logger.newline();
  }

  // ── No agent named: print copy-paste commands for each (manual hand-off). ──
  if (!spec) {
    const installed = detectAgents();
    logger.raw(pc.bold('Hand this off to an agent — run one of:'));
    for (const id of Object.keys(AGENTS) as Array<keyof typeof AGENTS>) {
      const s = AGENTS[id];
      const mark = installed.includes(s) ? pc.green('●') : pc.dim('○');
      logger.raw(`  ${mark} ${pc.cyan(manualCommand(s, instruction))}`);
    }
    logger.newline();
    logger.step(`Then run ${pc.cyan('atlas describe --apply')} to fold the result into the dashboard.`);
    logger.step(`Or skip the agent entirely: ${pc.cyan('atlas describe --heuristic')}.`);
    return;
  }

  // ── Agent named but not installed: print the manual command and stop. ──
  if (!agentAvailable(spec)) {
    logger.warn(`${spec.label} (${pc.bold(spec.bin)}) was not found on your PATH.`);
    logger.step(`Run it manually, then apply the result:`);
    logger.raw(`  ${pc.cyan(manualCommand(spec, instruction))}`);
    logger.raw(`  ${pc.cyan('atlas describe --apply')}`);
    return;
  }

  // ── Agent named and --no-run: just print the command. ──
  if (flags.run === false) {
    logger.step(`Run ${spec.label} when ready:`);
    logger.raw(`  ${pc.cyan(manualCommand(spec, instruction))}`);
    logger.step(`Then: ${pc.cyan('atlas describe --apply')}`);
    return;
  }

  // ── Auto-run the agent, then apply whatever it wrote. ──
  logger.step(`Handing ${assets.length} assets to ${pc.bold(spec.label)}…`);
  logger.newline();
  const ok = runAgent(spec, instruction, config.root);
  logger.newline();
  if (!ok) {
    logger.warn(`${spec.label} did not exit cleanly.`);
    logger.step(`If it still wrote ${pc.cyan(HANDOFF_FILES.answers)}, run ${pc.cyan('atlas describe --apply')}.`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(packet.answers)) {
    logger.warn(`${spec.label} finished but ${pc.cyan(packet.answers)} was not created.`);
    logger.step(`Re-run the agent, or apply manually once the file exists: ${pc.cyan('atlas describe --apply')}.`);
    process.exitCode = 1;
    return;
  }
  const answers = readAnswers(packet.answers);
  const applied = applyAnswers(assets, answers, spec.id);
  logger.success(`Assets described by ${spec.label}`, `${applied}/${assets.length}`);
  persist(result, config);
}

/** When applying without a named agent, prefer the agent stamp if discernible. */
function inferSourceFromAnswers(agent: string | undefined): 'claude' | 'codex' | 'cursor' {
  if (agent && isAgentId(agent)) return agent;
  return 'claude';
}
