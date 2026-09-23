# Development

Atlas is an npm-workspaces monorepo:

```
packages/
├─ schema/      @codebase-atlas/schema — types for the analysis output (shared)
├─ cli/         codebase-atlas — the published CLI (the analyzer)
└─ dashboard/   the React + Vite dashboard the CLI serves and exports
apps/
└─ site/        the landing page + user docs (Next.js + Fumadocs)
docs/           contributor docs (this folder)
```

The CLI and the dashboard both compile against `@codebase-atlas/schema`, so a
change to the output shape is a type error on both sides until each is updated.

## Prerequisites

- Node.js `>=20`
- npm (one `package-lock.json` at the root — don't add others)

## Setup

```bash
npm install                  # every workspace; also builds packages/schema
npm run build                # schema → dashboard → CLI
```

## Run from source

The CLI runs directly from TypeScript via `tsx` — no build needed for iteration.
Paths are relative to `packages/cli`:

```bash
npm run dev -- analyze --root examples/sample-app
npm run dev -- serve  --root examples/sample-app
```

`serve` and `export` need the dashboard built (`npm run build:dashboard`); from
source the CLI reads it straight from `packages/dashboard/dist`.

## Root scripts

| Script | Purpose |
| --- | --- |
| `build` | Build schema, dashboard and CLI, in dependency order. |
| `build:schema` / `build:dashboard` / `build:cli` / `build:site` | Build one workspace. |
| `dev` | Run the CLI from source (`tsx`). Pass CLI args after `--`. |
| `analyze` / `serve` | Shortcuts for `dev -- analyze` / `dev -- serve`. |
| `dev:dashboard` | Vite dev server for the dashboard. |
| `dev:site` | Next.js dev server for the website. |
| `test` | CLI test suite (vitest). |
| `typecheck` | Type-check every workspace. |

Run any workspace script directly with `-w`, e.g.
`npm run test:watch -w codebase-atlas`.

## Test

```bash
npm test
npm run test:watch -w codebase-atlas
```

Tests live under [`packages/cli/tests/`](../packages/cli/tests).

## The dashboard

A React + Vite + Tailwind app in [`packages/dashboard/`](../packages/dashboard).
It renders an `AnalysisResult` it loads from `/data.json` (served) or
`./data.json` (exported). Its types in `src/types.ts` are derived from the schema
package, loosened so that a `data.json` from an older Atlas still renders.

```bash
npm run dev:dashboard        # vite dev server
```

In dev mode the app fetches `packages/dashboard/public/data.json` (git-ignored).
Generate it from any project, e.g. the bundled sample:

```bash
npm run analyze -- examples/sample-app
cp packages/cli/examples/sample-app/.atlas/analysis.json packages/dashboard/public/data.json
```

Source for each view lives under `packages/dashboard/src/views/`.

## The website

[`apps/site`](../apps/site) is a Next.js app built with
[Fumadocs](https://fumadocs.dev): the landing page is `app/(home)/`, and the user
docs are MDX under `content/docs/` (sidebar order in the `meta.json` files).

```bash
npm run dev:site             # http://localhost:3000
npm run build:site           # static export → apps/site/out
```

It deploys to GitHub Pages under `/atlas/` via
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml), which sets
`NEXT_PUBLIC_BASE_PATH=/atlas` for the build.

When you add or change a CLI command, update its page under
`apps/site/content/docs/cli/` and the list in `apps/site/lib/data/commands.ts`.

## Publishing the CLI

Only `codebase-atlas` is published; the schema, dashboard and site packages are
private. From the root:

```bash
npm publish -w codebase-atlas
```

`prepublishOnly` builds every package, and `prepack` copies the dashboard build,
the root README and LICENSE into `packages/cli` so the tarball ships them. Check
the contents first with `npm pack --dry-run -w codebase-atlas`.

The schema is a devDependency of the CLI (its types are erased at build time), so
consumers never need to install it.

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
[`packages/cli/src/extractors/`](../packages/cli/src/extractors) and register it in
[`packages/cli/src/extractors/index.ts`](../packages/cli/src/extractors/index.ts)
(`builtinExtractors()`). New output fields go in
[`packages/schema/src/index.ts`](../packages/schema/src/index.ts); CLI-only types
(config, extractors, plugins) stay in
[`packages/cli/src/core/types.ts`](../packages/cli/src/core/types.ts).

## Project conventions

- **CommonJS** output, `strict` TypeScript.
- Detection is **AST-based only** — never branch on folder or file names.
- `serve` / `export` must never write into the scanned project; only `analyze`
  writes (into `.atlas/`).
- Asset objects hold **plain serializable data** only (no live ts-morph nodes), so
  the whole `AnalysisResult` round-trips through JSON.
