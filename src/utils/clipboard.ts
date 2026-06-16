/**
 * Best-effort clipboard copy with no native dependencies.
 *
 * Shells out to the platform's clipboard tool (pbcopy / clip / wl-copy / xclip /
 * xsel). Returns true only if a tool accepted the text; callers should fall back
 * to printing the text when it returns false (headless box, missing tool, etc.).
 */
import { spawnSync } from 'child_process';

interface ClipboardTool {
  bin: string;
  args: string[];
}

/** Candidate copy commands, in priority order, per platform. */
function candidates(): ClipboardTool[] {
  if (process.platform === 'darwin') return [{ bin: 'pbcopy', args: [] }];
  if (process.platform === 'win32') return [{ bin: 'clip', args: [] }];
  // Linux / BSD: prefer Wayland, then X11 helpers.
  return [
    { bin: 'wl-copy', args: [] },
    { bin: 'xclip', args: ['-selection', 'clipboard'] },
    { bin: 'xsel', args: ['--clipboard', '--input'] },
  ];
}

/** Copy `text` to the system clipboard. Returns whether a tool accepted it. */
export function copyToClipboard(text: string): boolean {
  for (const tool of candidates()) {
    try {
      // stdin carries the text; stdout/stderr are ignored so we never block on a
      // tool that forks a clipboard daemon holding the pipe open (e.g. xclip).
      // `timeout` is a final guard against any tool that still hangs.
      const res = spawnSync(tool.bin, tool.args, {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
        timeout: 2000,
      });
      if (!res.error && res.status === 0) return true;
    } catch {
      /* try the next candidate */
    }
  }
  return false;
}
