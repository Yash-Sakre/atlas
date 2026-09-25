/**
 * Interactive-prompt plumbing for the CLI.
 *
 * `@clack/prompts` is ESM-only while the CLI compiles to CommonJS, so it is
 * loaded lazily through a real dynamic `import()` — which also keeps it out of
 * scripted (non-TTY) runs entirely.
 */
type Clack = typeof import('@clack/prompts', { with: { 'resolution-mode': 'import' } });

let clack: Promise<Clack> | undefined;

/** Load `@clack/prompts` once. */
export function prompts(): Promise<Clack> {
  clack ??= import('@clack/prompts');
  return clack;
}

/** True when we can ask the user questions (a real terminal, not CI or a pipe). */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

/** Thrown when the user cancels a prompt (Ctrl+C / Esc); `run()` exits quietly on it. */
export class PromptCancelled extends Error {
  constructor() {
    super('Cancelled');
  }
}

/** Unwrap a prompt answer, turning a cancel into {@link PromptCancelled}. */
export async function answer<T>(value: Promise<T>): Promise<Exclude<T, symbol>> {
  const p = await prompts();
  const v = await value;
  if (p.isCancel(v)) {
    p.cancel('Cancelled.');
    throw new PromptCancelled();
  }
  return v as Exclude<T, symbol>;
}
