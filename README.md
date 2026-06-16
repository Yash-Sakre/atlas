# Atlas

[![CI](https://github.com/Yash-Sakre/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Yash-Sakre/atlas/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/website-atlas-6ee7b7)](https://yash-sakre.github.io/atlas/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Storybook + Compodoc + Madge + auto-generated docs for modern frontend codebases.

🌐 **Landing page:** https://yash-sakre.github.io/atlas/

Scan an entire React / Next.js / Vite / TypeScript codebase and automatically
**discover, analyze, and document every reusable asset** — components, hooks,
utilities, contexts, stores, and routes — so a new developer can see what
already exists *before* writing new code.

Everything is detected by **AST semantics, never by folder names**. The tool
works just as well in a tidy design system as in a messy enterprise monorepo
where a hook lives in `stuff.tsx` next to a formatter.

```bash
npx codebase-atlas analyze
```

…produces JSON outputs **and** an interactive React dashboard served at a link.

> 📖 **Full documentation** lives in [`docs/`](docs/README.md):
> [Architecture](docs/architecture.md) ·
> [Commands](docs/commands.md) ·
> [Hosting & Deployment](docs/hosting.md) ·
> [Development](docs/development.md)

---

## Quick start

```bash
# Analyze the current project and open the dashboard at a local link
npx codebase-atlas serve
```

This scans the project, then serves an interactive React dashboard at
`http://localhost:4321` and opens it in your browser. **Nothing is written into
your codebase** — the analysis is cached under `~/.atlas/`.

Run it against the bundled demo:

```bash
npx codebase-atlas serve --root examples/sample-app
```

### Hosting it

Export a self-contained static bundle (the dashboard + `data.json`) to deploy
anywhere (Netlify, Vercel, S3, GitHub Pages, nginx):

```bash
atlas export --out-dir ~/my-codebase-site
# then deploy that folder — the app fetches ./data.json at runtime
```

---

## Commands

| Command | Description |
| --- | --- |
| `serve` | Analyze and serve the interactive React dashboard at a local link. |
| `export` | Write a hostable static dashboard bundle (app + `data.json`) to an external folder. |
| `analyze` | Scan the project; write the JSON analysis outputs. |
| `describe` | Hand every asset to a coding agent (Claude / Codex / Cursor) for richer descriptions — or regenerate the offline heuristic ones. |
| `graph` | Print the dependency graph as an ASCII tree (`--json` for raw). |
| `dead-code` | Report unused exports, orphan files, duplicate candidates. |
| `search <query>` | Fuzzy-search every discovered asset. |
| `watch` | Re-analyze automatically (incrementally) on file changes. |

Common flags: `--root <dir>`, `--out-dir <dir>`, `--json`, `--no-cache`.
`serve` adds `--port <n>`, `--no-open`, `--reanalyze`.

> The dashboard is a React + Vite app under [`dashboard/`](dashboard/). It ships
> prebuilt; rebuild it with `npm run build:dashboard`.

```bash
atlas search authentication
# ● AuthContext   [context]
# ● AuthProvider  [component]
# ● useAuth       [hook]
# ● LoginScreen   [component]
```

---

## What it detects (semantically)

| Asset | How it's classified (AST only) |
| --- | --- |
| **Components** | PascalCase symbol that returns JSX — incl. function, arrow, `forwardRef`, `memo`, and class components. Props + defaultProps resolved via the type checker. |
| **Hooks** | `use*` symbol (React's own contract) that doesn't render JSX. Params, return type, and which React/custom hooks it calls. |
| **Utilities** | Any other top-level function. Classified as validator / formatter / helper, with purity + async inference. |
| **Contexts & state** | `createContext`, `<X.Provider>`, Zustand `create`, Redux `createSlice`, Jotai/Recoil `atom` — detected by **call + import origin**, with state shape. |
| **Routes** | React Router (`<Route>` / `createBrowserRouter` incl. nested + `lazy`), TanStack Router (`createFileRoute` / `createRoute` / `createRootRoute`), Next.js App Router (`page`/`layout`/`route`), and Pages Router — mapped to URL paths. Framework is detected **per workspace**, so routers nested under `apps/*` in a monorepo resolve correctly. |

For every asset it also computes **usage count**, **import/usage locations**,
**dependencies**, **dead-code/orphan/duplicate** status, and a structured
**description**: purpose, responsibilities, inputs, outputs,
when to use, when *not* to use, examples, and potential improvements.

---

## Output

`analyze` writes JSON outputs into the project's `.atlas/`:

```
.atlas/
├─ analysis.json        # full snapshot (used by the other commands)
├─ components.json
├─ hooks.json
├─ utils.json
├─ contexts.json
├─ routes.json
├─ graph.json
├─ dead-code.json
├─ architecture.json
└─ search.json
```

`serve` / `export` write **nothing** into the project. They cache the analysis
under `~/.atlas/cache/<project-hash>/` and render it with the React
dashboard:

```
Overview · Components · Hooks · Utils · Contexts · Routes · Dependency Tree (ReactFlow)
```

Each asset follows this shape:

```jsonc
{
  "id": "src/components/Button.tsx#Button",
  "name": "Button",
  "type": "component",
  "path": "src/components/Button.tsx",
  "componentKind": "function",
  "props": [{ "name": "variant", "type": "'primary' | 'ghost'", "optional": true }],
  "usedIn": [{ "filePath": "src/Form.tsx", "line": 12, "kind": "jsx" }],
  "usageCount": 5,
  "dependencies": ["src/utils/cn.ts#cn"],
  "description": { "purpose": "…", "whenToUse": "…", "source": "heuristic" },
  "examples": [],
  "tags": ["component", "function", "exported"]
}
```

---

## Documentation

A rich, structured description is generated **offline** for every asset — no API
keys, no network, no cost. The heuristic describer reads each asset's static
metadata (names, params/props, JSDoc, route paths, usage) to produce purpose,
responsibilities, inputs/outputs, dependencies, when-to-use, and example notes.

### Hand off to a coding agent (`describe`)

Want descriptions richer than a heuristic can write? Hand the assets to a coding
agent you already run — **Claude Code, Codex, or Cursor**. Atlas itself stays
offline; it just builds a packet and ingests what the agent writes back.

```bash
# Write a hand-off packet and print the exact command for each detected agent
atlas describe

# …or auto-run an agent end-to-end, then fold its answers into the dashboard
atlas describe --agent claude     # claude | codex | cursor
```

`describe` writes a packet under `.atlas/handoff/`:

```
.atlas/handoff/
├─ PROMPT.md          # instructions + the exact answer schema for the agent
├─ assets.json        # every asset's id, kind, signature, props/params, usage
└─ descriptions.json  # ← the agent writes this (one rich description per id)
```

The agent reads `PROMPT.md` + `assets.json` and writes `descriptions.json`. Then:

```bash
atlas describe --apply           # merge the agent's answers into the analysis
```

Each agent-authored description is tagged with its `source` (`claude` / `codex` /
`cursor`) so the dashboard badges it distinctly from heuristic text. Any asset
the agent skips keeps its heuristic description as a fallback.

```bash
atlas describe --heuristic        # (re)generate the offline descriptions instead
atlas describe --agent codex --no-run   # write the packet but don't invoke the agent
```

---

## Configuration

Drop an `atlas.config.json` at the project root (or an
`atlas` key in `package.json`):

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

Environment overrides: `ATLAS_VERBOSE=1`.

---

## Monorepo support

npm/yarn/pnpm workspaces, **Turborepo**, and **Nx** are auto-detected from
`package.json` `workspaces`, `pnpm-workspace.yaml`, or `nx.json`. Every asset is
tagged with its owning workspace, and the architecture report surfaces
cross-package coupling.

---

## Architecture

```
src/
├─ core/          types contract · config · project loader · analyzer (orchestrator)
├─ extractors/    component · hook · util · context/store · route  (+ ast-utils)
├─ analysis/      usage · graph · dead-code · architecture
├─ ai/            offline heuristic describer · agent hand-off (claude/codex/cursor)
├─ search/        Fuse.js index
├─ serve/         dashboard static server · cache paths · result loader
├─ output/        JSON writer
├─ plugins/       plugin loader
├─ utils/         logger · incremental cache · hashing
└─ cli/           commander commands

dashboard/        React + Vite dashboard app (ships prebuilt in dashboard/dist)
```

**Extensibility — plugin system.** A plugin can contribute extractors (new asset
kinds or frameworks) and post-process the result:

```ts
import type { Plugin } from 'codebase-atlas';

const plugin: Plugin = {
  name: 'graphql-operations',
  extractors: [new MyGraphqlExtractor()],
  enrich(result) {
    /* mutate/annotate the final AnalysisResult */
  },
};
export default plugin;
```

The pipeline is: **load project → extractors (cache + plugins) → usage →
graph → dead-code → architecture → describe → search index**, then the React
dashboard renders the result (served by `serve` or deployed via `export`).

---

## Development

```bash
npm install
npm run dev -- analyze --root examples/sample-app   # run from source via tsx
npm run build                                        # compile to dist/
npm test                                             # vitest
npm run typecheck
```

## License

MIT
