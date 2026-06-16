/**
 * Heuristic (offline) describer.
 *
 * Produces a structured {@link AIDescription} purely from an asset's static
 * metadata — no network, no API keys. The goal is prose that reads like a human
 * wrote it: each asset's *role* is inferred from naming conventions, its concrete
 * shape (props/params/return) is spelled out, and a real usage signal is folded
 * in so the reader immediately knows how load-bearing the asset is.
 */
import type {
  AIDescription,
  Asset,
  ComponentAsset,
  ContextAsset,
  HookAsset,
  ParamInfo,
  PropInfo,
  RouteAsset,
  UtilAsset,
} from '../core/types';

/* ----------------------------- text helpers ------------------------------ */

/**
 * Normalize a type string for prose: strip fully-resolved `import("…/x").Type`
 * paths down to `Type`, collapse whitespace, and truncate runaway types.
 */
function cleanType(type: string | undefined): string {
  let s = (type || 'unknown')
    .replace(/import\((?:"[^"]*"|'[^']*')\)\./g, '') // complete  import("…/x").Type → Type
    .replace(/import\([^)]*$/g, '…') // truncated import("…  (extractor cut the path) → …
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 48) s = `${s.slice(0, 47)}…`;
  return s;
}

/** Render a single prop/param as `name?: type` with a cleaned-up type. */
function renderField(f: PropInfo | ParamInfo): string {
  return `${f.name}${f.optional ? '?' : ''}: ${cleanType(f.type)}`;
}

/** Render a field list for prose, capping at `max` with a "+N more" tail. */
function fieldSummary(fields: Array<PropInfo | ParamInfo>, max = 8): string {
  if (!fields.length) return '';
  const shown = fields.slice(0, max).map(renderField);
  const extra = fields.length - max;
  return extra > 0 ? `${shown.join(', ')} (+${extra} more)` : list(shown);
}

/** Pluralize a count: `1 prop`, `3 props`. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** Join a list as natural English: `a`, `a and b`, `a, b and c`. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Cap a list and add "…" so prose never runs away. */
function few(items: string[], max = 4): string[] {
  return items.length > max ? [...items.slice(0, max), '…'] : items;
}

/**
 * Turn an identifier into a readable phrase:
 * `BlurFadeButton` → "blur fade button", `useAuthToken` → "auth token",
 * `formatCurrency` → "format currency". Leading `use` is dropped for hooks.
 */
function humanize(name: string): string {
  return name
    .replace(/^use(?=[A-Z])/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** First non-empty sentence of the JSDoc, used to seed `purpose`. */
function jsDocPurpose(asset: Asset): string | undefined {
  if (!asset.jsDoc) return undefined;
  const trimmed = asset.jsDoc
    .replace(/\/\*\*?|\*\/|^\s*\*/gm, '')
    .replace(/@\w+[^\n]*/g, '') // strip @param/@returns tag lines
    .replace(/\s+/g, ' ')
    .trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A short, honest signal of how load-bearing the asset is. This is the single
 * most useful non-generic fact we can state about any asset.
 */
function usageNote(asset: Asset): string {
  const n = asset.usageCount;
  if (n === 0) return 'Currently has no internal references — it may be an entry point, public API, or dead code.';
  if (n === 1) return 'Referenced in 1 place, so changes here are low-risk.';
  if (n >= 12) return `Heavily relied on — referenced in ${n} places, so treat it as stable API and change with care.`;
  if (n >= 5) return `Referenced in ${n} places across the codebase.`;
  return `Referenced in ${n} places.`;
}

/* --------------------------- role inference ------------------------------ */

/** Pattern → human role. First match wins; only confident matches apply. */
const COMPONENT_ROLES: Array<[RegExp, string]> = [
  [/(button|btn|cta)$/i, 'an interactive control'],
  [/(modal|dialog|drawer|popover|popup|sheet|overlay|lightbox)$/i, 'an overlay surface'],
  [/(card|panel|tile|box|section|container|wrapper)$/i, 'a content container'],
  [/(layout|page|screen|view|template|shell|scaffold)$/i, 'a page-level layout'],
  [/(nav|navbar|navigation|header|footer|sidebar|menu|breadcrumbs?|tabs?)$/i, 'a navigation element'],
  [/(form|field|input|select|checkbox|radio|switch|toggle|slider|picker|textarea|combobox|dropdown)$/i, 'a form control'],
  [/(list|table|grid|row|column|item|cell|tree)$/i, 'a data-display element'],
  [/(icon|avatar|badge|chip|tag|pill|logo|image|thumbnail)$/i, 'a small visual element'],
  [/(spinner|loader|loading|skeleton|progress)$/i, 'a loading indicator'],
  [/(toast|alert|banner|notification|snackbar|message)$/i, 'a feedback element'],
  [/(tooltip|hint|popover)$/i, 'a contextual hint element'],
  [/(chart|graph|plot|map|gauge|sparkline)$/i, 'a data-visualization element'],
];

function componentRole(name: string): string {
  for (const [re, role] of COMPONENT_ROLES) if (re.test(name)) return role;
  return 'a React component';
}

/** Naming-convention → utility intent. Drives natural "Call x to …" prose. */
const UTIL_INTENTS: Array<[RegExp, { role: string; action: string }]> = [
  [/^(is|are|has|have|can|should|will|did|does|contains|includes|matches|equals)/i, { role: 'a predicate', action: 'check a condition and branch on the result' }],
  [/^(format|fmt|to|render|display|pretty|humanize|stringify)/i, { role: 'a formatter', action: 'turn a value into a display-ready string' }],
  [/^(parse|decode|deserialize|read|from)/i, { role: 'a parser', action: 'turn raw input into a structured value' }],
  [/^(get|select|find|pick|resolve|lookup|compute|calc|calculate)/i, { role: 'an accessor/derivation', action: 'derive or look up a value' }],
  [/^(sort|filter|map|reduce|group|merge|flatten|normalize|transform|convert|clamp|lerp)/i, { role: 'a transformer', action: 'reshape or constrain data' }],
  [/^(create|make|build|generate|init|of)/i, { role: 'a factory', action: 'construct a new value or object' }],
  [/^(fetch|load|save|post|put|patch|delete|request|send|upload|download|sync)/i, { role: 'an I/O helper', action: 'perform an external read/write' }],
  [/^(validate|assert|ensure|check)/i, { role: 'a validator', action: 'validate input and surface errors' }],
];

function utilIntent(name: string, kind: UtilAsset['utilKind']): { role: string; action: string } {
  for (const [re, intent] of UTIL_INTENTS) if (re.test(name)) return intent;
  if (kind === 'constant') return { role: 'a shared constant', action: 'reference a single source-of-truth value' };
  return { role: `a ${kind}`, action: 'reuse this logic without duplicating it' };
}

/** Describe what a hook actually does from the React primitives it builds on. */
function hookBehaviors(asset: HookAsset): string[] {
  const used = asset.reactHooksUsed;
  const has = (re: RegExp) => used.some((h) => re.test(h));
  const out: string[] = [];
  if (has(/^use(State|Reducer)$/)) out.push('owns local state');
  if (has(/^use(Effect|LayoutEffect|InsertionEffect)$/)) out.push('runs side effects');
  if (has(/^useContext$/)) out.push('reads React context');
  if (has(/^use(Ref|ImperativeHandle)$/)) out.push('holds a mutable ref');
  if (has(/^use(Memo|Callback)$/)) out.push('memoizes derived values');
  if (has(/query|mutation|swr|fetch|infinite/i) || asset.callsHooks.some((h) => /query|swr|fetch/i.test(h)))
    out.push('fetches/caches remote data');
  return out;
}

/* ------------------------------ builders --------------------------------- */

function describeComponent(asset: ComponentAsset, jsDoc: string): AIDescription {
  const human = humanize(asset.name);
  const role = componentRole(asset.name);
  const props = asset.props;
  const required = props.filter((p) => !p.optional);
  const composes = asset.rendersComponents;

  const purpose =
    jsDoc ||
    `\`${asset.name}\` is ${role}${human && !role.includes(human) ? ` for "${human}"` : ''}. ${usageNote(asset)}`;

  const responsibilities = [
    props.length
      ? `Render its UI from ${count(props.length, 'prop')}${required.length ? ` (${list(few(required.map((p) => p.name)))} required)` : ' (all optional)'}.`
      : 'Render a self-contained, prop-less UI.',
    ...(composes.length ? [`Compose ${list(few(composes))}.`] : []),
    ...(asset.componentKind === 'forwardRef' ? ['Forward a ref to a DOM/child node.'] : []),
    ...(asset.componentKind === 'memo' ? ['Skip re-renders when props are unchanged (memoized).'] : []),
  ];

  return {
    purpose,
    responsibilities,
    inputs: props.length
      ? `Props — ${fieldSummary(props)}.`
      : 'No props; it is fully self-contained.',
    outputs: `A rendered React element${composes.length ? `, composed of ${list(few(composes))}` : ''}.`,
    dependencies: asset.dependencies,
    whenToUse: `Reach for \`<${asset.name} />\` when you need ${role}${
      required.length ? `; you must pass ${list(required.map((p) => p.name))}` : ''
    }.`,
    whenNotToUse: props.length
      ? 'Avoid forcing unrelated variations through new props — split into a separate component once the prop surface gets conditional.'
      : 'If you need configurable behaviour, prefer a component that accepts props rather than copying this one.',
    commonUsage: `<${asset.name}${required.map((p) => ` ${p.name}={…}`).join('')} />`,
    examples: [
      required.length
        ? `<${asset.name}${required.map((p) => ` ${p.name}={${p.name}}`).join('')} />`
        : `<${asset.name} />`,
    ],
    improvements: buildImprovements(asset),
    source: 'heuristic',
  };
}

function describeHook(asset: HookAsset, jsDoc: string): AIDescription {
  const params = asset.params;
  const behaviors = hookBehaviors(asset);
  const ret = asset.returnType ? cleanType(asset.returnType) : 'a value';
  const sig = params.map((p) => p.name).join(', ');

  const purpose =
    jsDoc ||
    `\`${asset.name}\` is a custom hook that ${
      behaviors.length ? list(behaviors) : 'encapsulates reusable component logic'
    }. ${usageNote(asset)}`;

  return {
    purpose,
    responsibilities: [
      behaviors.length ? `Internally ${list(behaviors)}.` : 'Bundle related logic behind one reusable call.',
      ...(asset.callsHooks.length ? [`Build on ${list(few(asset.callsHooks))}.`] : []),
      `Hand back ${ret} for the caller to consume.`,
    ],
    inputs: params.length ? `Arguments — ${fieldSummary(params)}.` : 'Takes no arguments.',
    outputs: `Returns ${ret}.`,
    dependencies: asset.dependencies,
    whenToUse: `Call \`${asset.name}(${sig})\` inside a component or another hook to reuse this logic instead of re-implementing it.`,
    whenNotToUse:
      'Never call it conditionally, in a loop, or outside React render — it must obey the Rules of Hooks.',
    commonUsage: `const ${returnBinding(asset)} = ${asset.name}(${sig});`,
    examples: [`const ${returnBinding(asset)} = ${asset.name}(${sig});`],
    improvements: buildImprovements(asset),
    source: 'heuristic',
  };
}

function describeUtil(asset: UtilAsset, jsDoc: string): AIDescription {
  const params = asset.params;
  const { role, action } = utilIntent(asset.name, asset.utilKind);
  const ret = asset.returnType ? cleanType(asset.returnType) : 'a value';
  const sig = params.map((p) => p.name).join(', ');
  const callExpr = `${asset.isAsync ? 'await ' : ''}${asset.name}(${sig})`;

  const purpose =
    jsDoc ||
    `\`${asset.name}\` is ${role}${asset.isAsync ? ' (async)' : ''}${
      asset.pure ? ', pure and side-effect-free' : ''
    }. ${usageNote(asset)}`;

  return {
    purpose,
    responsibilities: [
      `Use it to ${action}.`,
      asset.pure
        ? 'Produce the same output for the same input — safe to call anywhere, including during render.'
        : 'May read or mutate external state — mind where you call it.',
      ...(asset.isAsync ? ['Resolve asynchronously (returns a Promise).'] : []),
    ],
    inputs: params.length ? `Arguments — ${fieldSummary(params)}.` : 'Takes no arguments.',
    outputs: `Returns ${ret}${asset.isAsync ? ' (wrapped in a Promise)' : ''}.`,
    dependencies: asset.dependencies,
    whenToUse: `Call \`${callExpr}\` to ${action}.`,
    whenNotToUse: asset.pure
      ? 'It carries no React/stateful behaviour — use a hook if you need state, effects, or context.'
      : 'Avoid calling it in render or other pure contexts where its side effects would be surprising.',
    commonUsage: `const result = ${callExpr};`,
    examples: [`const result = ${callExpr};`],
    improvements: buildImprovements(asset),
    source: 'heuristic',
  };
}

function describeContext(asset: ContextAsset, jsDoc: string): AIDescription {
  const shape = asset.stateShape;
  const fields = shape.length ? list(few(shape)) : 'its state fields';
  const isProvider = asset.type === 'provider';

  const purpose =
    jsDoc ||
    `\`${asset.name}\` is a ${asset.stateKind} ${asset.type} sharing ${
      shape.length ? `${fields}` : 'application state'
    } across the tree. ${usageNote(asset)}`;

  return {
    purpose,
    responsibilities: [
      `Expose shared state via ${asset.stateKind} so consumers skip prop-drilling.`,
      shape.length ? `Surface ${list(few(shape))}.` : 'Surface state fields (shape not statically resolved).',
      ...(isProvider ? ['Wrap a subtree and supply the value to everything beneath it.'] : []),
    ],
    inputs: isProvider
      ? 'Children to wrap, plus any initial-value/config props.'
      : 'No direct inputs — consumers read from it on demand.',
    outputs: shape.length ? `Shared state: ${list(shape)}.` : 'Shared state for consumers.',
    dependencies: asset.dependencies,
    whenToUse: `Use it when ${fields} must be read or updated by components far apart in the tree.`,
    whenNotToUse:
      'Skip it for state used by a single component or its immediate children — local state re-renders far less.',
    commonUsage:
      asset.stateKind === 'react-context'
        ? `const value = useContext(${asset.name});`
        : `const state = ${asset.name}();`,
    examples: [
      asset.stateKind === 'react-context'
        ? `const { ${(shape.slice(0, 2).join(', ')) || 'value'} } = useContext(${asset.name});`
        : `const ${shape[0] ?? 'state'} = ${asset.name}();`,
    ],
    improvements: buildImprovements(asset),
    source: 'heuristic',
  };
}

function describeRoute(asset: RouteAsset, jsDoc: string): AIDescription {
  const path = asset.routePath || '(unresolved path)';
  const dynamic = /:|\[/.test(path);
  const kind = asset.segmentKind ?? 'route';

  const purpose =
    jsDoc ||
    `${asset.router} ${kind} serving \`${path}\`${
      asset.componentName ? `, rendering ${asset.componentName}` : ''
    }. ${usageNote(asset)}`;

  return {
    purpose,
    responsibilities: [
      `Match navigation to \`${path}\`${dynamic ? ' (with dynamic segments)' : ''}.`,
      ...(asset.componentName ? [`Render the ${asset.componentName} view.`] : []),
      ...(asset.childRoutes.length ? [`Nest ${list(few(asset.childRoutes))}.`] : []),
    ],
    inputs: dynamic
      ? `URL \`${path}\` — dynamic segments become route params.`
      : `URL \`${path}\` (static).`,
    outputs: asset.componentName ? `The ${asset.componentName} view.` : `The view for \`${path}\`.`,
    dependencies: asset.dependencies,
    whenToUse: `Navigate to \`${path}\` to land on this ${kind}.`,
    whenNotToUse:
      'This is a routing entry, not a reusable component — don\'t import it into other views; lift shared UI into a component instead.',
    commonUsage: dynamic ? `navigate(\`${path.replace(/:(\w+)/g, '${$1}')}\`)` : `navigate("${path}")`,
    examples: [dynamic ? `<Link to={\`${path.replace(/:(\w+)/g, '${$1}')}\`}>…</Link>` : `<Link to="${path}">…</Link>`],
    improvements: buildImprovements(asset),
    source: 'heuristic',
  };
}

/* ----------------------------- improvements ------------------------------ */

/** Only emit improvements that are actually actionable for this asset. */
function buildImprovements(asset: Asset): string[] {
  const out: string[] = [];

  if (asset.usageCount === 0) {
    out.push('No references found — confirm it is a real entry point or remove it as dead code.');
  }
  if (!asset.jsDoc) {
    out.push('Add a one-line JSDoc summary so this description can quote your intent instead of inferring it.');
  }

  switch (asset.type) {
    case 'component': {
      const weak = asset.props.filter((p) => !p.type || p.type === 'unknown' || p.type === 'any');
      if (weak.length) out.push(`Tighten prop types — ${list(few(weak.map((p) => p.name)))} ${weak.length === 1 ? 'is' : 'are'} untyped/any.`);
      if (asset.props.length > 8) out.push(`${asset.props.length} props is a lot — consider grouping related ones into an object or splitting the component.`);
      break;
    }
    case 'hook':
      if (!asset.returnType) out.push('Annotate the return type so callers get autocomplete.');
      break;
    case 'utility':
      if (!asset.returnType) out.push('Annotate the return type explicitly.');
      if (asset.pure) out.push('Pure function — a great candidate for fast, isolated unit tests.');
      break;
    case 'context':
    case 'store':
    case 'provider':
      if (!asset.stateShape.length) out.push('Type the exposed state shape so consumers know what is available.');
      break;
    case 'route':
      if (asset.componentName) out.push('Add route-level loading and error boundaries.');
      else out.push('Resolve and document which component this route renders.');
      break;
  }

  return out.length ? out : ['Looks solid — no obvious heuristic improvements.'];
}

/** Pick a readable destructuring/binding name for a hook's return value. */
function returnBinding(asset: HookAsset): string {
  const base = humanize(asset.name).split(' ').slice(-1)[0] || 'value';
  return base;
}

/* -------------------------------- entry ---------------------------------- */

/**
 * Build a structured, network-free {@link AIDescription} for any asset.
 * Exhaustive over the {@link Asset} discriminated union.
 */
export function heuristicDescribe(asset: Asset): AIDescription {
  const jsDoc = jsDocPurpose(asset) ?? '';

  switch (asset.type) {
    case 'component':
      return describeComponent(asset, jsDoc);
    case 'hook':
      return describeHook(asset, jsDoc);
    case 'utility':
      return describeUtil(asset, jsDoc);
    case 'context':
    case 'store':
    case 'provider':
      return describeContext(asset, jsDoc);
    case 'route':
      return describeRoute(asset, jsDoc);
    default: {
      // Exhaustiveness guard — should be unreachable.
      const _never: never = asset;
      throw new Error(`Unhandled asset type: ${JSON.stringify(_never)}`);
    }
  }
}
