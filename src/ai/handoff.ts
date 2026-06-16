/**
 * The `atlas describe` hand-off packet.
 *
 * {@link writeHandoff} serializes everything a coding agent needs to write a
 * great description for every discovered asset — names, kinds, signatures,
 * props/params, dependencies and real usage — plus a `PROMPT.md` spelling out
 * the exact JSON the agent must return. {@link applyAnswers} ingests that JSON
 * back onto each asset's `.description`, stamped with the agent as `source`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AIDescription, Asset, DescriptionSource } from '../core/types';

/** Filenames inside the hand-off directory. */
export const HANDOFF_FILES = {
  prompt: 'PROMPT.md',
  assets: 'assets.json',
  answers: 'descriptions.json',
} as const;

/** The slim, agent-facing view of one asset (no internal/derived noise). */
interface AssetContext {
  id: string;
  name: string;
  type: Asset['type'];
  path: string;
  exportType: string;
  signature?: string;
  jsDoc?: string;
  usageCount: number;
  dependencies: string[];
  tags: string[];
  /** Kind-specific shape (props, params, returnType, routePath, …). */
  details: Record<string, unknown>;
}

/** Just the fields an agent fills in; the rest of {@link AIDescription} is derived. */
export type AnswerDescription = Omit<AIDescription, 'dependencies' | 'source'>;

/** Pull out the bits of an asset that actually inform a description. */
function toContext(asset: Asset): AssetContext {
  const details: Record<string, unknown> = {};
  switch (asset.type) {
    case 'component':
      details.componentKind = asset.componentKind;
      details.props = asset.props;
      details.renders = asset.rendersComponents;
      break;
    case 'hook':
      details.params = asset.params;
      details.returnType = asset.returnType;
      details.reactHooksUsed = asset.reactHooksUsed;
      details.callsHooks = asset.callsHooks;
      break;
    case 'utility':
      details.utilKind = asset.utilKind;
      details.params = asset.params;
      details.returnType = asset.returnType;
      details.isAsync = asset.isAsync;
      details.pure = asset.pure;
      break;
    case 'context':
    case 'store':
    case 'provider':
      details.stateKind = asset.stateKind;
      details.stateShape = asset.stateShape;
      break;
    case 'route':
      details.router = asset.router;
      details.routePath = asset.routePath;
      details.componentName = asset.componentName;
      break;
  }
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    path: asset.path,
    exportType: asset.exportType,
    signature: asset.signature,
    jsDoc: asset.jsDoc,
    usageCount: asset.usageCount,
    dependencies: asset.dependencies,
    tags: asset.tags,
    details,
  };
}

/** The instructions handed to the agent, with the answer schema spelled out. */
function buildPrompt(assets: Asset[], label: string): string {
  return `# Atlas → ${label} documentation hand-off

You are documenting a frontend codebase for a developer browser/dashboard. Atlas
has already discovered **${assets.length} reusable assets** (components, hooks,
utilities, contexts/stores and routes) by AST analysis. Your job is to write a
**short, accurate** description for each one — grounded in what the code actually
does. Brevity is the goal: a developer skimming the dashboard wants the gist, not
an essay.

## Inputs

- \`${HANDOFF_FILES.assets}\` — one entry per asset: its id, name, kind, file
  \`path\`, signature, props/params/return shape, dependencies and real usage
  count. Open the referenced source files only if the name + signature aren't
  enough to write one clear line.

## What to produce

Write \`${HANDOFF_FILES.answers}\` — a single JSON object keyed by the asset
\`id\` (copy the ids verbatim). Each value MUST match:

\`\`\`json
{
  "<asset id>": {
    "purpose": "ONE short sentence: what it is / does. For a component, say what it renders.",
    "commonUsage": "A single idiomatic one-line usage snippet.",
    "examples": ["One realistic example line"]
  }
}
\`\`\`

## Rules

- Cover **every** id in \`${HANDOFF_FILES.assets}\`. Do not invent ids.
- \`purpose\` is **one sentence, ≤ 20 words**. No "This component…" preamble —
  start with the verb (e.g. "Renders a paginated table of …").
- Be specific to *this* code — reference real prop/param names. Generic
  boilerplate ("a reusable React component") is worse than nothing.
- \`commonUsage\` and \`examples\` are optional; include them only when they add
  signal. Omit any field you'd leave generic — Atlas keeps its own value for it.
- No markdown inside the JSON string values.
- Output **only** valid JSON to \`${HANDOFF_FILES.answers}\` — no prose around it.

When you are done, the developer will run \`atlas describe --apply\` to fold your
descriptions into the dashboard.
`;
}

export interface HandoffPaths {
  dir: string;
  prompt: string;
  assets: string;
  answers: string;
}

/** Write `PROMPT.md` + `assets.json` into `dir`, returning the packet paths. */
export function writeHandoff(dir: string, assets: Asset[], agentLabel: string): HandoffPaths {
  mkdirSync(dir, { recursive: true });
  const paths: HandoffPaths = {
    dir,
    prompt: join(dir, HANDOFF_FILES.prompt),
    assets: join(dir, HANDOFF_FILES.assets),
    answers: join(dir, HANDOFF_FILES.answers),
  };
  writeFileSync(paths.assets, JSON.stringify(assets.map(toContext), null, 2), 'utf8');
  writeFileSync(paths.prompt, buildPrompt(assets, agentLabel), 'utf8');
  return paths;
}

/** Parse `descriptions.json` into an id → answer map (tolerant of array form). */
export function readAnswers(file: string): Record<string, Partial<AnswerDescription>> {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  // Accept either an object keyed by id or an array of `{ id, ...answer }`.
  if (Array.isArray(raw)) {
    const map: Record<string, Partial<AnswerDescription>> = {};
    for (const entry of raw) {
      if (entry && typeof entry.id === 'string') {
        const { id, ...rest } = entry;
        map[id] = rest;
      }
    }
    return map;
  }
  if (raw && typeof raw === 'object') return raw as Record<string, Partial<AnswerDescription>>;
  throw new Error('descriptions file is neither an object keyed by id nor an array');
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Merge agent answers onto assets in place. An asset's existing (heuristic)
 * description is used to backfill any field the agent left blank, so the result
 * is always complete. Returns how many assets the agent actually described.
 */
export function applyAnswers(
  assets: Asset[],
  answers: Record<string, Partial<AnswerDescription>>,
  source: DescriptionSource,
): number {
  let applied = 0;
  for (const asset of assets) {
    const a = answers[asset.id];
    if (!a) continue;
    const prev = asset.description;
    asset.description = {
      purpose: str(a.purpose, prev?.purpose ?? ''),
      responsibilities: strList(a.responsibilities).length
        ? strList(a.responsibilities)
        : prev?.responsibilities ?? [],
      inputs: str(a.inputs, prev?.inputs ?? ''),
      outputs: str(a.outputs, prev?.outputs ?? ''),
      dependencies: asset.dependencies,
      whenToUse: str(a.whenToUse, prev?.whenToUse ?? ''),
      whenNotToUse: str(a.whenNotToUse, prev?.whenNotToUse ?? ''),
      commonUsage: str(a.commonUsage, prev?.commonUsage ?? ''),
      examples: strList(a.examples).length ? strList(a.examples) : prev?.examples ?? [],
      improvements: strList(a.improvements).length ? strList(a.improvements) : prev?.improvements ?? [],
      source,
    };
    applied += 1;
  }
  return applied;
}
