import { createHash } from 'crypto';

/** Stable short hash for cache keys and content fingerprints. */
export function hash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

/** Hash of file content + mtime, used by the incremental cache. */
export function fileFingerprint(content: string, mtimeMs: number): string {
  return hash(`${content.length}:${mtimeMs}:${content}`);
}
