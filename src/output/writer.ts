/** Persists the analysis result to the `.atlas/` JSON output set. */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AnalysisResult } from '../core/types';

export interface WrittenOutputs {
  dir: string;
  files: string[];
}

export function writeJsonOutputs(result: AnalysisResult, root: string, outDir: string): WrittenOutputs {
  const dir = join(root, outDir);
  mkdirSync(dir, { recursive: true });

  const files: string[] = [];
  const write = (name: string, data: unknown) => {
    const p = join(dir, name);
    writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    files.push(p);
  };

  write('components.json', result.components);
  write('hooks.json', result.hooks);
  write('utils.json', result.utils);
  write('contexts.json', result.contexts);
  write('routes.json', result.routes);
  write('graph.json', result.graph);
  write('dead-code.json', result.deadCode);
  write('architecture.json', result.architecture);
  write('dependencies.json', result.dependencies);
  write('design-system.json', result.designSystem);
  write('search.json', result.search);

  // The design system also ships as a standalone DESIGN.md document.
  if (result.designSystem?.markdown) {
    const mdPath = join(dir, 'DESIGN.md');
    writeFileSync(mdPath, result.designSystem.markdown, 'utf8');
    files.push(mdPath);
  }
  write('analysis.json', result); // full snapshot, used by `docs`/`graph`/`search` commands

  return { dir, files };
}

export function resultPath(root: string, outDir: string): string {
  return join(root, outDir, 'analysis.json');
}
