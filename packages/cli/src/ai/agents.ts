/**
 * Coding-agent registry for the `atlas describe` hand-off.
 *
 * Atlas does not call any LLM itself (no API keys, no network). Instead it hands
 * work to whatever coding agent the developer already runs — Claude Code, Codex,
 * or Cursor — and ingests what the agent prints back. This module knows how to
 * detect those agents on the `PATH` and drive them head-less with read-only
 * tools, so the hand-off can be automated end to end without the agent ever
 * needing permission to write into the project.
 */
import { spawn, spawnSync } from 'child_process';
import type { DescriptionSource } from '../core/types';

/** Agents Atlas knows how to hand work off to. Matches {@link DescriptionSource}. */
export type AgentId = Exclude<DescriptionSource, 'heuristic'>;

export interface AgentSpec {
  id: AgentId;
  /** Human label for prompts and CLI output. */
  label: string;
  /** Executable expected on the `PATH`. */
  bin: string;
  /**
   * Whether the head-less run reads its prompt from stdin. Agents that can't
   * are given a short instruction pointing at a prompt file on disk instead.
   */
  stdin: boolean;
  /**
   * argv for a one-shot, read-only run whose answer is printed to stdout. For
   * `stdin: false` agents, `instruction` is appended as the prompt.
   */
  headlessArgs: (opts: { model?: string; instruction?: string }) => string[];
  /** argv for the copy-paste command shown in the manual hand-off. */
  manualArgs: (instruction: string) => string[];
}

/** The supported agents and how each is driven head-less. */
export const AGENTS: Record<AgentId, AgentSpec> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    bin: 'claude',
    stdin: true,
    // Read-only tools: it may open source files, but never edit the project.
    headlessArgs: ({ model }) => [
      '-p',
      '--tools',
      'Read,Grep,Glob',
      '--no-session-persistence',
      ...(model ? ['--model', model] : []),
    ],
    manualArgs: (instruction) => ['-p', instruction],
  },
  codex: {
    id: 'codex',
    label: 'Codex CLI',
    bin: 'codex',
    stdin: true,
    headlessArgs: ({ model }) => [
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      ...(model ? ['-m', model] : []),
      '-',
    ],
    manualArgs: (instruction) => ['exec', instruction],
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor Agent',
    bin: 'cursor-agent',
    stdin: false,
    headlessArgs: ({ model, instruction }) => [
      '-p',
      '--output-format',
      'text',
      ...(model ? ['--model', model] : []),
      instruction ?? '',
    ],
    manualArgs: (instruction) => ['-p', instruction],
  },
};

/** Narrow an arbitrary string to a known {@link AgentId}. */
export function isAgentId(value: string): value is AgentId {
  return Object.prototype.hasOwnProperty.call(AGENTS, value);
}

/** True when the agent's executable is resolvable on the current `PATH`. */
export function agentAvailable(spec: AgentSpec): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    return spawnSync(probe, [spec.bin], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/** Every supported agent currently installed on this machine. */
export function detectAgents(): AgentSpec[] {
  return Object.values(AGENTS).filter(agentAvailable);
}

export interface AgentRun {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export interface RunAgentOptions {
  cwd: string;
  /** Full prompt (stdin agents) — or the path-pointing instruction for the rest. */
  prompt: string;
  model?: string;
  /** Kill the agent if it runs longer than this. */
  timeoutMs?: number;
}

/**
 * Run `spec` head-less and capture what it prints. Asynchronous so a CLI
 * spinner keeps animating and several batches can run side by side.
 */
export function runAgentCapture(spec: AgentSpec, opts: RunAgentOptions): Promise<AgentRun> {
  return new Promise((resolve) => {
    const args = spec.headlessArgs({ model: opts.model, instruction: spec.stdin ? undefined : opts.prompt });
    const child = spawn(spec.bin, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          stderr += `\n[atlas] ${spec.label} timed out after ${Math.round(opts.timeoutMs! / 1000)}s`;
          child.kill('SIGTERM');
        }, opts.timeoutMs)
      : undefined;

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: `${stderr}\n${err.message}` });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });

    // An agent that exits before draining stdin raises EPIPE — surfaced via 'close'.
    child.stdin.on('error', () => {});
    child.stdin.end(spec.stdin ? opts.prompt : undefined);
  });
}

/** The exact shell command a user can copy to drive `spec` by hand. */
export function manualCommand(spec: AgentSpec, instruction: string): string {
  return [spec.bin, ...spec.manualArgs(instruction)]
    .map((part) => (/[\s"']/.test(part) ? JSON.stringify(part) : part))
    .join(' ');
}
