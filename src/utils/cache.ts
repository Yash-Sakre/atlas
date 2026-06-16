/** Incremental cache: stores per-file fingerprints + extracted assets on disk. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import type { Asset } from '../core/types';
import { fileFingerprint } from './hash';

interface CacheShape {
  version: number;
  files: Record<string, { fingerprint: string; assets: Asset[] }>;
}

const CACHE_VERSION = 1;

export class IncrementalCache {
  private data: CacheShape = { version: CACHE_VERSION, files: {} };
  private hits = 0;
  private misses = 0;

  constructor(private readonly cachePath: string, enabled: boolean) {
    if (enabled && existsSync(cachePath)) {
      try {
        const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as CacheShape;
        if (parsed.version === CACHE_VERSION) this.data = parsed;
      } catch {
        /* corrupt cache → start fresh */
      }
    }
  }

  /** Returns cached assets if the file is unchanged, else null. */
  get(relPath: string, absPath: string, content: string): Asset[] | null {
    const entry = this.data.files[relPath];
    if (!entry) {
      this.misses++;
      return null;
    }
    const fp = fileFingerprint(content, this.mtime(absPath));
    if (entry.fingerprint === fp) {
      this.hits++;
      return entry.assets;
    }
    this.misses++;
    return null;
  }

  set(relPath: string, absPath: string, content: string, assets: Asset[]): void {
    this.data.files[relPath] = {
      fingerprint: fileFingerprint(content, this.mtime(absPath)),
      assets,
    };
  }

  /** Drop entries for files that no longer exist. */
  prune(livePaths: Set<string>): void {
    for (const key of Object.keys(this.data.files)) {
      if (!livePaths.has(key)) delete this.data.files[key];
    }
  }

  flush(): void {
    mkdirSync(dirname(this.cachePath), { recursive: true });
    writeFileSync(this.cachePath, JSON.stringify(this.data), 'utf8');
  }

  get stats() {
    return { hits: this.hits, misses: this.misses };
  }

  private mtime(absPath: string): number {
    try {
      return statSync(absPath).mtimeMs;
    } catch {
      return 0;
    }
  }
}

export function cachePathFor(root: string, outDir: string): string {
  return join(root, outDir, '.cache', 'assets.json');
}
