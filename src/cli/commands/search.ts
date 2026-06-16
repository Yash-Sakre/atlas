import { loadConfig } from '../../core/config';
import { loadOrAnalyze } from '../loadResult';
import { buildSearchIndex, searchRecords } from '../../search/searchIndex';
import { allAssets } from '../../core/types';
import { logger, pc } from '../../utils/logger';

const TYPE_COLOR: Record<string, (s: string) => string> = {
  component: pc.green,
  hook: pc.cyan,
  utility: pc.yellow,
  context: pc.magenta,
  store: pc.magenta,
  provider: pc.magenta,
  route: pc.blue,
};

export async function searchCommand(
  query: string,
  flags: { root: string; outDir?: string; json?: boolean; limit?: string },
): Promise<void> {
  const config = loadConfig(flags.root, { outDir: flags.outDir });
  const result = await loadOrAnalyze(config);

  // Prefer the persisted index; rebuild if absent.
  const records = result.search?.length ? result.search : buildSearchIndex(allAssets(result));
  const limit = flags.limit ? parseInt(flags.limit, 10) : 20;
  const hits = searchRecords(records, query, limit);

  if (flags.json) {
    logger.raw(JSON.stringify(hits, null, 2));
    return;
  }

  logger.banner(`Search · "${query}"`);
  if (!hits.length) {
    logger.warn('No matches found.');
    return;
  }
  for (const h of hits) {
    const color = TYPE_COLOR[h.type] ?? pc.white;
    logger.raw(`${color('●')} ${pc.bold(h.name)} ${pc.dim(`[${h.type}]`)}`);
    logger.raw(`   ${pc.dim(h.path)}`);
    if (h.description) logger.raw(`   ${truncate(h.description, 100)}`);
    logger.newline();
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
