# Architecture — How Atlas works

Atlas is a CLI tool with two parts:

1. **The analyzer** (Node/TypeScript in [`src/`](../src)) — scans a codebase and
   produces a single `AnalysisResult` JSON object.
2. **The dashboard** (React/Vite in [`dashboard/`](../dashboard)) — renders that
   JSON as an interactive UI.

The two are decoupled: the analyzer emits data, the dashboard consumes it (either
live over HTTP at `/data.json`, or from a bundled `data.json` file).

---

## Source layout

```
src/
├─ index.ts          # bin entry → builds and runs the CLI
├─ cli/
│  ├─ index.ts       # commander program: defines every command + flags
│  ├─ loadResult.ts  # shared helper to load/produce an analysis for a command
│  └─ commands/      # one file per command (analyze, serve, export, …)
├─ core/
│  ├─ types.ts       # the data contract (Asset, AnalysisResult, Config, Plugin…)
│  ├─ config.ts      # config load + framework + workspace detection
│  ├─ project.ts     # loads files into a ts-morph Project (the ExtractionContext)
│  └─ analyzer.ts    # the orchestrator — runs the whole pipeline
├─ extractors/       # AST → assets (component, hook, util, context/store, route)
├─ analysis/         # usage resolution · module refs · dependency graph · dead-code · architecture
├─ ai/               # offline heuristic describer + coding-agent hand-off
├─ search/           # Fuse.js search index builder
├─ serve/            # static server · cache paths · cached-result loader
├─ output/           # JSON writer (for `analyze`)
├─ plugins/          # plugin loader
└─ utils/            # logger · incremental cache · hashing · progress · clipboard

dashboard/           # React + Vite dashboard (prebuilt into dashboard/dist)
```

---

## The analysis pipeline

The whole flow lives in [`src/core/analyzer.ts`](../src/core/analyzer.ts) →
`runAnalysis(config, hooks)`. Phases run in order:

```
load project
  → load plugins
    → extract assets (per file, with incremental cache + plugin extractors)
      → resolve default exports
        → resolve usage (who uses each asset, how many times, where)
          → build dependency graph
            → detect dead code (unused exports, orphan files, duplicates)
              → analyze architecture (layers, cross-package coupling)
                → generate documentation (offline heuristic, or agent-supplied)
                  → build search index (Fuse.js)
                    → plugins enrich the final result
```

The function returns one `AnalysisResult` containing `components`, `hooks`,
`utils`, `contexts`, `routes`, `graph`, `deadCode`, `architecture`, `search`,
`meta`, and `stats`.

### 1. Load project — `core/project.ts`
Globs source files (config `include` / `exclude`) and loads them into a single
`ts-morph` `Project`. This gives every extractor a shared TypeScript type checker.

### 2. Extract assets — `extractors/`
Each file is run through every extractor. Extractors classify symbols **by AST
shape, not naming convention**:

| Extractor | Detects |
| --- | --- |
| `componentExtractor` | PascalCase symbol returning JSX — function, arrow, `forwardRef`, `memo`, class. Props resolved via the type checker. |
| `hookExtractor` | `use*` symbol that does **not** render JSX; captures params, return type, and which hooks it calls. |
| `utilExtractor` | Any other top-level function; classified validator / formatter / helper with purity + async inference. |
| `contextExtractor` | `createContext`, `<X.Provider>`, Zustand `create`, Redux `createSlice`, Jotai/Recoil `atom` — matched by **call + import origin**. |
| `routeExtractor` | React Router, TanStack Router, Next.js App & Pages Router → mapped to URL paths. Framework detected **per workspace**. |

**Performance note:** extraction wraps each file in
`project.forgetNodesCreatedInBlock(...)` so ts-morph wrappers from the type
checker are freed after each file. Without this, a large repo grows the heap
unbounded and OOMs. The loop also yields every 20 files so the CLI spinner keeps
ticking during the CPU-bound traversal.

**Incremental cache:** results are cached per file keyed by content hash
(`utils/cache.ts`). Unchanged files are read from cache; the cache is pruned of
deleted files and flushed at the end (disabled with `--no-cache`).

### 3. Resolve default exports
Marks assets exported via a detached `export default X` / `export { X as default }`
(needed for Next.js pages and `const X = …; export default X`).

### 4. Usage analysis — `analysis/usageAnalyzer.ts`
Walks the project to compute, for each asset: usage count, the exact import/usage
locations, and which other assets it depends on.

Bindings come from every import syntax, not just static `import` statements —
`analysis/moduleRefs.ts` additionally resolves `await import()`, `import().then()`,
`React.lazy` / `next/dynamic` loaders, `require()`, `import x = require()`, and
type-position `import('…').T`. Without this, code-split modules bind to nothing
and land in the dead-code report.

### 5–7. Graph, dead code, architecture
- `graphBuilder.ts` — builds the dependency graph from resolved dependencies.
- `deadCode.ts` — flags unused exports, orphan files, and duplicate candidates.
- `architecture.ts` — derives layers and surfaces cross-package coupling.

### 8. Documentation — `ai/`
Every asset gets a structured description (purpose, responsibilities,
inputs/outputs, when-to-use / when-not, examples, improvements).
- **Default:** `ai/heuristic.ts` generates these **offline** from static metadata
  — no API key, no network, no cost.
- **Optional:** `ai/handoff.ts` + `ai/agents.ts` build a packet for a coding agent
  (Claude / Codex / Cursor) to write richer descriptions, folded back in via
  `describe --apply`. See [Commands](commands.md#describe).

### 9. Search index — `search/searchIndex.ts`
Builds a Fuse.js index over all assets for fuzzy search.

---

## Configuration — `core/config.ts`

Atlas reads (first match wins): `atlas.config.json`, `.atlasrc`, `.atlasrc.json`,
or an `"atlas"` key in `package.json`.

```jsonc
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/*.stories.tsx"],
  "outDir": ".atlas",
  "cache": true,
  "sharedLayers": ["shared", "common", "ui"],
  "plugins": ["./tools/my-analyzer.js"]
}
```

Defaults: includes `**/*.{ts,tsx,js,jsx,mjs,cjs}`; excludes `node_modules`,
`dist`, `build`, `.next`, `out`, `coverage`, `.atlas`, `*.d.ts`, and
test/spec/stories files. User `exclude` entries are **added** to these defaults.

Env override: `ATLAS_VERBOSE=1` for verbose logging.

### Framework & monorepo detection
`detectFramework()` inspects `package.json` deps + directory probes (`app/`,
`pages/`) to identify Next.js (and its router mode), Vite, React Router, TanStack
Router, and state libraries. `detectWorkspaces()` reads `pnpm-workspace.yaml`,
`package.json` `workspaces` (npm/yarn/Turborepo), or `nx.json` so each workspace's
framework resolves independently and assets are tagged with their owning package.

---

## How the data reaches the dashboard

There are two paths, and **neither writes into the scanned project**:

```
┌─────────────┐   runAnalysis()   ┌──────────────┐
│  your code  │ ────────────────► │ AnalysisResult│
└─────────────┘                   └──────┬───────┘
                                         │
              serve ───────────┐         ├──────────► export
       (HTTP server,           │         │       (static bundle,
        getData → /data.json)  ▼         ▼        copies dashboard/dist
                        cached at ~/.atlas/        + writes data.json)
                        cache/<hash>/analysis.json
```

- **`serve`** (`serve/server.ts`): a dependency-free Node `http` server. It serves
  `dashboard/dist` and exposes the live analysis JSON at `/data.json` (with an SPA
  fallback to `index.html` for hash routing). If the preferred port is busy it
  falls back to an OS-assigned free port. Best-effort opens the browser.
- **`export`** (`cli/commands/exportSite.ts`): copies the prebuilt dashboard to an
  **external** folder and writes a static `data.json` next to it. Refuses to write
  inside the scanned project.

**Caching for serve/export** (`serve/paths.ts`, `serve/result.ts`): the result is
cached at `~/.atlas/cache/<sha1-of-root>/analysis.json`. Subsequent runs load the
cache instantly; `--reanalyze` forces a fresh scan. (This is separate from the
`.atlas/` JSON outputs that the `analyze` command writes into the project.)

---

## Extensibility — plugins

A plugin can contribute extractors (new asset kinds / frameworks) and post-process
the final result:

```ts
import type { Plugin } from 'codebase-atlas';

const plugin: Plugin = {
  name: 'graphql-operations',
  extractors: [new MyGraphqlExtractor()],
  enrich(result) {
    /* mutate / annotate the final AnalysisResult */
  },
};
export default plugin;
```

Register it in the `plugins` array of your config. It's loaded by
`plugins/loader.ts`, its extractors run alongside the built-ins, and `enrich()`
runs last in the pipeline.
</content>
