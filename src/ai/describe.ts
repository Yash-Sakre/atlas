/**
 * Documentation layer.
 *
 * {@link describeAssets} mutates each asset's `.description` in place using the
 * deterministic {@link heuristicDescribe} (AST/metadata only — no network, no
 * API keys). `onProgress(done, total)` fires after each asset is described.
 */
import type { Asset } from '../core/types';
import { heuristicDescribe } from './heuristic';

/**
 * Describe every asset, mutating `asset.description` in place via the heuristic.
 * `onProgress(done, total)` fires after each asset is described.
 */
export async function describeAssets(
  assets: Asset[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = assets.length;
  let done = 0;
  for (const asset of assets) {
    asset.description = heuristicDescribe(asset);
    done += 1;
    onProgress?.(done, total);
    // Yield periodically so the event loop (and any CLI spinner) keeps running
    // through this synchronous describe pass.
    if (done % 50 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
