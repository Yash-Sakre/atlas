/**
 * Batched, head-less agent runs for `atlas describe`.
 *
 * Instead of asking one agent session to document thousands of assets (which
 * blows through context and fails all-or-nothing), assets are split into small
 * batches. Each batch's prompt carries its assets inline; the agent — running
 * with read-only tools — prints a JSON object to stdout, which Atlas parses and
 * merges into `descriptions.json` right away. A crash or Ctrl+C therefore keeps
 * every finished batch, and the next run resumes with only what's missing.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Asset } from '../core/types';
import { runAgentCapture, type AgentSpec } from './agents';
import { answerSpec, saveAnswers, toContext, type AnswerDescription } from './handoff';

export interface BatchRunOptions {
  spec: AgentSpec;
  assets: Asset[];
  /** Project root — the agent's working directory. */
  cwd: string;
  /** Hand-off dir; prompts for non-stdin agents are written under it. */
  dir: string;
  /** Where merged answers are saved after each batch. */
  answersFile: string;
  batchSize?: number;
  concurrency?: number;
  model?: string;
  timeoutMs?: number;
  onProgress?: (p: BatchProgress) => void;
}

export interface BatchProgress {
  batchesDone: number;
  batches: number;
  described: number;
  total: number;
  failed: number;
}

export interface BatchRunResult extends BatchProgress {
  /** Last few error lines from failed batches, for the summary. */
  errors: string[];
}

type Answers = Record<string, Partial<AnswerDescription>>;

export const DEFAULT_BATCH_SIZE = 25;
export const DEFAULT_CONCURRENCY = 2;

/** Split `items` into consecutive chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** The prompt for one batch — assets inline, answer printed to stdout. */
export function buildBatchPrompt(assets: Asset[]): string {
  return `# Atlas documentation batch

You are documenting a frontend codebase for a developer dashboard. Atlas found
these ${assets.length} reusable assets by AST analysis. Write a **short, accurate**
description for each, grounded in what the code actually does. Your working
directory is the project root: open a source file (by its \`path\`) only if the
name + signature below aren't enough to write one clear line.

${answerSpec('Print a single JSON object', 'the asset list below')}- Print **only** the JSON object to stdout — no prose, no code fences, and do not write any files.

## Assets

\`\`\`json
${JSON.stringify(assets.map(toContext), null, 1)}
\`\`\`
`;
}

/**
 * Pull the JSON object out of an agent's reply. Agents sometimes wrap it in a
 * code fence or add a sentence around it, so take the outermost `{…}`.
 */
export function extractJson(text: string): Answers | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('{');
    const end = c.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(c.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Answers;
    } catch {
      /* try the next candidate */
    }
  }
  return undefined;
}

/** Keep only answers for ids in this batch that carry a usable `purpose`. */
function validAnswers(raw: Answers, ids: Set<string>): Answers {
  const out: Answers = {};
  for (const [id, a] of Object.entries(raw)) {
    if (ids.has(id) && a && typeof a === 'object' && typeof a.purpose === 'string' && a.purpose.trim()) {
      out[id] = a;
    }
  }
  return out;
}

/** Last non-empty line of an agent's stderr/stdout, to explain a failure. */
function lastLine(text: string): string {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  return (lines[lines.length - 1] ?? '').slice(0, 200);
}

/**
 * Describe `assets` with `spec`, batch by batch, saving answers as they land.
 * Each batch is retried once if the agent's reply can't be parsed.
 */
export async function describeInBatches(opts: BatchRunOptions): Promise<BatchRunResult> {
  const batches = chunk(opts.assets, opts.batchSize ?? DEFAULT_BATCH_SIZE);
  const progress: BatchProgress = {
    batchesDone: 0,
    batches: batches.length,
    described: 0,
    total: opts.assets.length,
    failed: 0,
  };
  const errors: string[] = [];
  const promptDir = join(opts.dir, 'batches');
  if (!opts.spec.stdin) mkdirSync(promptDir, { recursive: true });

  const runBatch = async (batch: Asset[], index: number): Promise<void> => {
    let prompt = buildBatchPrompt(batch);
    if (!opts.spec.stdin) {
      // This agent can't read stdin: park the prompt on disk and point at it.
      const file = join(promptDir, `batch-${String(index + 1).padStart(3, '0')}.md`);
      writeFileSync(file, prompt, 'utf8');
      prompt = `Read ${file} and follow it exactly. Print only the JSON object it asks for.`;
    }

    const ids = new Set(batch.map((a) => a.id));
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const run = await runAgentCapture(opts.spec, {
        cwd: opts.cwd,
        prompt,
        model: opts.model,
        timeoutMs: opts.timeoutMs,
      });
      const parsed = run.ok ? extractJson(run.stdout) : undefined;
      const answers = parsed ? validAnswers(parsed, ids) : {};
      const count = Object.keys(answers).length;
      if (count > 0) {
        saveAnswers(opts.answersFile, answers, opts.spec.id);
        progress.described += count;
        return;
      }
      lastError = run.ok
        ? `batch ${index + 1}: reply had no usable JSON (${lastLine(run.stdout) || 'empty output'})`
        : `batch ${index + 1}: ${lastLine(run.stderr) || lastLine(run.stdout) || 'agent exited with an error'}`;
    }
    progress.failed += batch.length;
    errors.push(lastError);
  };

  // A small worker pool: `concurrency` batches in flight at once.
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      await runBatch(batches[i], i);
      progress.batchesDone += 1;
      opts.onProgress?.({ ...progress });
    }
  };
  const pool = Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, batches.length));
  opts.onProgress?.({ ...progress });
  await Promise.all(Array.from({ length: pool }, worker));

  return { ...progress, errors: errors.slice(-3) };
}
