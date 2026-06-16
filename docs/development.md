# Development

## Prerequisites

- Node.js `>=18`
- npm (the repo uses `package-lock.json`)

## Setup

```bash
npm install                  # CLI deps
npm run build:dashboard      # build the dashboard once (or use the prebuilt dist)
```

## Run from source

The CLI runs directly from TypeScript via `tsx` — no build needed for iteration:

```bash
npm run dev -- analyze --root examples/sample-app
npm run dev -- serve  --root examples/sample-app
```

There are also shortcuts:

```bash
npm run analyze              # tsx src/index.ts analyze
npm run serve                # tsx src/index.ts serve
```

## Build

```bash
npm run build                # tsc → dist/  (the published CLI)
npm run build:dashboard      # vite build → dashboard/dist
npm run build:all            # both
npm run typecheck            # tsc --noEmit
```

After `npm run build`, run the compiled CLI with `npm start -- <command>` or
`node dist/index.js <command>`.

## Test

```bash
npm test                     # vitest run
npm run test:watch           # vitest watch mode
```

Tests live under [`tests/`](../tests).

## Scripts reference

| Script | Command | Purpose |
| --- | --- | --- |
| `build` | `tsc -p tsconfig.json` | Compile the CLI to `dist/`. |
| `build:dashboard` | install + `vite build` | Build the React dashboard to `dashboard/dist`. |
| `build:all` | `build` + `build:dashboard` | Build everything. |
| `dev` | `tsx src/index.ts` | Run the CLI from source. |
| `start` | `node dist/index.js` | Run the compiled CLI. |
| `analyze` / `serve` | `tsx src/index.ts <cmd>` | Convenience runners. |
| `test` / `test:watch` | `vitest` | Run the test suite. |
| `typecheck` | `tsc --noEmit` | Type-check without emitting. |
| `prepublishOnly` | `build:all` | Auto-build before `npm publish`. |

## The dashboard app

A separate React + Vite + Tailwind project in [`dashboard/`](../dashboard) with
its own `package.json`. It renders an `AnalysisResult` it loads from `/data.json`
(served) or `./data.json` (exported). Develop it standalone:

```bash
cd dashboard
npm install
npm run dev                  # vite dev server
```

Views: Overview · Components · Hooks · Utils · Contexts · Routes · Dependency Tree
(ReactFlow). Source under `dashboard/src/views/`.

## Extending Atlas — plugins

See [Architecture → Plugins](architecture.md#extensibility--plugins). A plugin
contributes extractors and/or an `enrich()` hook, and is registered in the
`plugins` array of your `atlas.config.json`.

```ts
import type { Plugin } from 'codebase-atlas';

const plugin: Plugin = {
  name: 'my-plugin',
  extractors: [new MyExtractor()],
  enrich(result, ctx) { /* annotate result */ },
};
export default plugin;
```

To add a new built-in asset kind instead, add an extractor under
[`src/extractors/`](../src/extractors) and register it in
[`src/extractors/index.ts`](../src/extractors/index.ts) (`builtinExtractors()`),
extending the types in [`src/core/types.ts`](../src/core/types.ts) as needed.

## Project conventions

- **CommonJS** output, `strict` TypeScript.
- Detection is **AST-based only** — never branch on folder or file names.
- `serve` / `export` must never write into the scanned project; only `analyze`
  writes (into `.atlas/`).
- Asset objects hold **plain serializable data** only (no live ts-morph nodes), so
  the whole `AnalysisResult` round-trips through JSON.
</content>
