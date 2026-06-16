import { loadConfig } from '../../core/config';
import { loadOrAnalyze } from '../loadResult';
import { logger, pc } from '../../utils/logger';
import type { DeadExport } from '../../core/types';

export async function deadCodeCommand(flags: { root: string; outDir?: string; json?: boolean }): Promise<void> {
  const config = loadConfig(flags.root, { outDir: flags.outDir });
  const result = await loadOrAnalyze(config);
  const dc = result.deadCode;

  if (flags.json) {
    logger.raw(JSON.stringify(dc, null, 2));
    return;
  }

  logger.banner('Dead Code Report');

  const section = (title: string, items: DeadExport[]) => {
    if (!items.length) return;
    logger.raw(pc.bold(pc.yellow(`\n${title} (${items.length})`)));
    for (const i of items) logger.raw(`  ${pc.yellow('⚠')} ${i.name} ${pc.dim(`— ${i.path}`)}`);
  };

  section('Unused components', dc.unusedComponents);
  section('Unused hooks', dc.unusedHooks);
  section('Unused utilities', dc.unusedUtils);
  section('Unused contexts/stores', dc.unusedContexts);

  if (dc.orphanFiles.length) {
    logger.raw(pc.bold(pc.yellow(`\nOrphan files (${dc.orphanFiles.length})`)));
    for (const f of dc.orphanFiles) logger.raw(`  ${pc.yellow('⚠')} ${f}`);
  }

  if (dc.duplicateCandidates.length) {
    logger.raw(pc.bold(pc.magenta(`\nDuplicate candidates (${dc.duplicateCandidates.length})`)));
    for (const d of dc.duplicateCandidates) {
      logger.raw(`  ${pc.magenta('≈')} ${d.names.join(', ')} ${pc.dim(`— ${d.reason}`)}`);
    }
  }

  const total =
    dc.deadExports.length + dc.orphanFiles.length + dc.duplicateCandidates.length;
  logger.newline();
  if (total === 0) logger.success('No dead code detected — nice and tidy.');
  else logger.warn(`${total} potential issues found.`);
}
