/**
 * Locating the original static files on disk.
 *
 * Atlas never copies, inlines or base64-encodes an asset: the analysis records
 * only a root-relative path, and `atlas serve` streams that exact file on
 * demand under `/__file/`. Previews therefore always show what's really in the
 * repo, and the dashboard bundle stays the same size no matter how much media
 * a project ships.
 *
 * On a hosted/static export there is no server to read the filesystem, so these
 * URLs 404 — every preview falls back to a typed placeholder tile.
 */
import type { StaticAsset, StaticAssetKind } from '../types';

const FILE_PREFIX = '/__file/';

/** URL that streams a project file from its path. */
export function fileUrl(path: string): string {
  return FILE_PREFIX + path.split('/').map(encodeURIComponent).join('/');
}

/** Kinds the browser can render inline from a URL. */
export function isPreviewable(kind: StaticAssetKind): boolean {
  return kind === 'image' || kind === 'vector' || kind === 'font' || kind === 'video';
}

const UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / 1024 ** i;
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${UNITS[i]}`;
}

/** "1440 × 900", or a dash when the format carries no intrinsic size. */
export function formatDimensions(a: StaticAsset): string {
  return a.dimensions ? `${a.dimensions.width} × ${a.dimensions.height}` : '—';
}
