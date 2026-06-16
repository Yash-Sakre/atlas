/**
 * Coding-agent registry for the `atlas describe` hand-off.
 *
 * Atlas does not call any LLM itself (no API keys, no network). Instead it hands
 * a structured packet to whatever coding agent the developer already runs —
 * Claude Code, Codex, or Cursor — and ingests what the agent writes back. This
 * module knows how to detect those agents on the `PATH` and invoke them
 * non-interactively so the hand-off can be automated end to end.
 */
import { spawnSync } from 'child_process';
import type { DescriptionSource } from '../core/types';

/** Agents Atlas knows how to hand work off to. Matches {@link DescriptionSource}. */
export type AgentId = Exclude<DescriptionSource, 'heuristic'>;

export interface AgentSpec {
  id: AgentId;
  /** Human label for prompts and CLI output. */
  label: string;
  /** Executable expected on the `PATH`. */
  bin: string;
  /** Build the argv for a one-shot, non-interactive run of `instruction`. */
  buildArgs: (instruction: string) => string[];
}

/**
 * The supported agents and how each is driven head-less. The instruction we pass
 * is short on purpose (it points the agent at the packet on disk) so it never
 * runs into shell-length or quoting limits.
 */
export const AGENTS: Record<AgentId, AgentSpec> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    bin: 'claude',
    buildArgs: (instruction) => ['-p', instruction],
  },
  codex: {
    id: 'codex',
    label: 'Codex CLI',
    bin: 'codex',
    buildArgs: (instruction) => ['exec', instruction],
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor Agent',
    bin: 'cursor-agent',
    buildArgs: (instruction) => ['-p', instruction],
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

/**
 * Run `spec` non-interactively with `instruction`, streaming its output straight
 * to the user's terminal so they can watch the agent work. Returns whether the
 * agent exited cleanly.
 */
export function runAgent(spec: AgentSpec, instruction: string, cwd: string): boolean {
  const res = spawnSync(spec.bin, spec.buildArgs(instruction), { cwd, stdio: 'inherit' });
  return res.status === 0;
}

/** The exact shell command a user can copy to drive `spec` by hand. */
export function manualCommand(spec: AgentSpec, instruction: string): string {
  return [spec.bin, ...spec.buildArgs(instruction)]
    .map((part) => (/[\s"']/.test(part) ? JSON.stringify(part) : part))
    .join(' ');
}
