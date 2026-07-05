/**
 * "Open in editor" deep links.
 *
 * Analyzer output stores paths *relative* to the project root (`asset.path`,
 * `usedIn[].filePath`), while `meta.root` is the absolute root on the machine
 * that ran the analysis. We join the two and hand the absolute path to an
 * editor's URL handler.
 *
 * The target editor defaults to VS Code but can be overridden without any UI:
 *   • `?editor=cursor` query param (wins), or
 *   • `localStorage['atlas:editor']`.
 *
 * Note: the links resolve on the machine whose paths are baked into the data
 * (i.e. local `atlas serve`). On a hosted dashboard the paths belong to the
 * original author's machine — that's inherent, not a bug.
 */

export type EditorId =
  | 'vscode'
  | 'vscode-insiders'
  | 'cursor'
  | 'windsurf'
  | 'zed';

/** URL scheme per editor. All accept `<scheme>://file<absPath>:<line>:<col>`. */
const SCHEMES: Record<EditorId, string> = {
  vscode: 'vscode',
  'vscode-insiders': 'vscode-insiders',
  cursor: 'cursor',
  windsurf: 'windsurf',
  zed: 'zed',
};

function readOverride(): EditorId | null {
  try {
    const q = new URLSearchParams(window.location.search).get('editor');
    const raw = (q || window.localStorage.getItem('atlas:editor') || '').toLowerCase();
    return raw && raw in SCHEMES ? (raw as EditorId) : null;
  } catch {
    return null;
  }
}

export function currentEditor(): EditorId {
  return readOverride() ?? 'vscode';
}

/** Absolute path from an absolute project root + a root-relative file path. */
export function absPath(root: string, relPath: string): string {
  const r = (root || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const rel = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!r) return rel ? `/${rel}` : '';
  return `${r}/${rel}`;
}

/**
 * Build an editor deep link. `line`/`col` are 1-based; missing/zero → 1.
 * Returns `null` when there's nothing to point at (no root or no path), so
 * callers can render plain text instead of a dead link.
 */
export function editorHref(
  root: string | undefined,
  relPath: string | undefined,
  line?: number,
  col?: number,
): string | null {
  if (!relPath) return null;
  const abs = absPath(root || '', relPath);
  if (!abs) return null;
  // The URL handler expects `<scheme>://file` + an absolute path that starts
  // with a slash. POSIX paths already do; Windows (`C:/…`) needs one prepended.
  const withSlash = abs.startsWith('/') ? abs : `/${abs}`;
  const l = Math.max(1, Math.floor(line || 1));
  const c = Math.max(1, Math.floor(col || 1));
  return `${SCHEMES[currentEditor()]}://file${withSlash}:${l}:${c}`;
}
