/** Terminal UX helpers: colored status lines, spinners, tables, banners. */
import pc from 'picocolors';

let spinnerTimer: NodeJS.Timeout | null = null;
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const CLEAR_LINE = '\x1b[2K\r'; // erase whole line + carriage return

/** A running spinner: call it to stop (with optional final text); `.update()` changes the live label. */
export interface Spinner {
  (finalText?: string): void;
  update(text: string): void;
}

export const logger = {
  banner(title: string): void {
    const line = '═'.repeat(title.length + 4);
    process.stdout.write(`\n${pc.cyan(line)}\n${pc.cyan('║')} ${pc.bold(title)} ${pc.cyan('║')}\n${pc.cyan(line)}\n\n`);
  },

  info(msg: string): void {
    process.stdout.write(`${pc.blue('ℹ')} ${msg}\n`);
  },

  success(label: string, value?: string | number): void {
    const v = value !== undefined ? `: ${pc.bold(String(value))}` : '';
    process.stdout.write(`${pc.green('✓')} ${label}${v}\n`);
  },

  warn(msg: string): void {
    process.stdout.write(`${pc.yellow('⚠')} ${pc.yellow(msg)}\n`);
  },

  error(msg: string): void {
    process.stderr.write(`${pc.red('✗')} ${pc.red(msg)}\n`);
  },

  step(msg: string): void {
    process.stdout.write(`${pc.dim('→')} ${pc.dim(msg)}\n`);
  },

  raw(msg: string): void {
    process.stdout.write(msg + '\n');
  },

  /**
   * Start an inline spinner. Returns a stop function that also carries an
   * `.update(text)` method to change the label while it spins (e.g. live phase
   * / progress). On a non-TTY it degrades to one static line and `.update()`
   * is a no-op so logs stay clean.
   */
  spinner(text: string): Spinner {
    let label = text;

    if (!process.stdout.isTTY) {
      process.stdout.write(`${pc.dim('→')} ${text}\n`);
      const noop = (() => {}) as Spinner;
      noop.update = () => {};
      return noop;
    }

    let i = 0;
    const render = () => process.stdout.write(`${CLEAR_LINE}${pc.cyan(FRAMES[i++ % FRAMES.length])} ${label}`);
    render();
    spinnerTimer = setInterval(render, 80);

    const stop = ((finalText?: string) => {
      if (spinnerTimer) clearInterval(spinnerTimer);
      spinnerTimer = null;
      process.stdout.write(`${CLEAR_LINE}${pc.green('✓')} ${finalText ?? label}\n`);
    }) as Spinner;
    stop.update = (next: string) => {
      label = next;
    };
    return stop;
  },

  /** Render a simple two-column key/value table. */
  table(rows: Array<[string, string | number]>): void {
    const width = Math.max(...rows.map((r) => r[0].length));
    for (const [k, v] of rows) {
      process.stdout.write(`  ${pc.dim(k.padEnd(width))}  ${pc.bold(String(v))}\n`);
    }
  },

  newline(): void {
    process.stdout.write('\n');
  },
};

export { pc };
