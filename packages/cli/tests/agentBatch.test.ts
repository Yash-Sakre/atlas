import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chunk, describeInBatches, extractJson } from '../src/ai/batch';
import { applyAnswers, readAnswers, restoreSavedAnswers, saveAnswers } from '../src/ai/handoff';
import type { AgentSpec } from '../src/ai/agents';
import type { Asset } from '../src/core/types';

function asset(id: string): Asset {
  return {
    id,
    name: id.split('#')[1],
    type: 'hook',
    path: id.split('#')[0],
    exportType: 'named',
    usageCount: 0,
    dependencies: [],
    tags: [],
    params: [],
    reactHooksUsed: [],
    callsHooks: [],
  } as unknown as Asset;
}

/** A stand-in agent: reads the batch prompt on stdin and echoes a purpose per id. */
function fakeAgent(script: string): AgentSpec {
  return {
    id: 'claude',
    label: 'Fake',
    bin: process.execPath,
    stdin: true,
    headlessArgs: () => ['-e', script],
    manualArgs: () => [],
  };
}

const ECHO_IDS = `
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  const ids = [...s.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
  const out = Object.fromEntries(ids.map((id) => [id, { purpose: 'Does ' + id }]));
  process.stdout.write('Here you go:\\n\`\`\`json\\n' + JSON.stringify(out) + '\\n\`\`\`');
});`;

describe('batch helpers', () => {
  it('chunks into fixed-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('```json\n{"a":{"purpose":"x"}}\n```')).toEqual({ a: { purpose: 'x' } });
    expect(extractJson('Sure! {"a":{"purpose":"x"}} Done.')).toEqual({ a: { purpose: 'x' } });
    expect(extractJson('no json here')).toBeUndefined();
    expect(extractJson('[1,2]')).toBeUndefined();
  });
});

describe('describeInBatches', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'atlas-batch-'));
  });

  it('runs every batch and saves stamped answers', async () => {
    const assets = ['a.ts#useA', 'b.ts#useB', 'c.ts#useC'].map(asset);
    const answersFile = join(dir, 'descriptions.json');
    const run = await describeInBatches({
      spec: fakeAgent(ECHO_IDS),
      assets,
      cwd: dir,
      dir,
      answersFile,
      batchSize: 2,
      concurrency: 2,
    });
    expect(run).toMatchObject({ batches: 2, batchesDone: 2, described: 3, failed: 0 });
    const saved = readAnswers(answersFile);
    expect(saved['b.ts#useB']).toEqual({ purpose: 'Does b.ts#useB', source: 'claude' });
  });

  it('reports batches whose reply has no usable JSON', async () => {
    const answersFile = join(dir, 'descriptions.json');
    const run = await describeInBatches({
      spec: fakeAgent(`process.stdin.resume().on('end', () => console.log('sorry'))`),
      assets: [asset('a.ts#useA')],
      cwd: dir,
      dir,
      answersFile,
    });
    expect(run.failed).toBe(1);
    expect(run.errors[0]).toMatch(/no usable JSON/);
    expect(existsSync(answersFile)).toBe(false);
  });
});

describe('saved answers', () => {
  it('restores agent descriptions with their source after re-analysis', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-restore-'));
    mkdirSync(join(root, '.atlas', 'handoff'), { recursive: true });
    saveAnswers(join(root, '.atlas', 'handoff', 'descriptions.json'), { 'a.ts#useA': { purpose: 'P' } }, 'codex');

    const assets = [asset('a.ts#useA'), asset('b.ts#useB')];
    expect(restoreSavedAnswers(assets, root, '.atlas')).toBe(1);
    expect(assets[0].description).toMatchObject({ purpose: 'P', source: 'codex' });
    expect(assets[1].description).toBeUndefined();
    expect(JSON.parse(readFileSync(join(root, '.atlas', 'handoff', 'descriptions.json'), 'utf8'))).toHaveProperty('a.ts#useA');
  });

  it('falls back to the given source for unstamped answers', () => {
    const assets = [asset('a.ts#useA')];
    applyAnswers(assets, { 'a.ts#useA': { purpose: 'P' } }, 'cursor');
    expect(assets[0].description?.source).toBe('cursor');
  });
});
