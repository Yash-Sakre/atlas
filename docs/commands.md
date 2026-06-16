# Commands — CLI reference

The binary is `atlas` (package `codebase-atlas`). Run any command with `npx`:

```bash
npx codebase-atlas <command> [options]
```

…or, if installed globally / linked, just `atlas <command>`.
During development, run from source with `npm run dev -- <command>` (uses `tsx`).

## Command summary

| Command | Description |
| --- | --- |
| [`serve`](#serve) | Analyze and serve the interactive React dashboard at a local link. |
| [`export`](#export) | Write a hostable static dashboard bundle (app + `data.json`) to an external folder. |
| [`analyze`](#analyze) | Scan the project; write the JSON analysis outputs into `.atlas/`. |
| [`describe`](#describe) | Hand assets to a coding agent for richer descriptions, or regenerate heuristic ones. |
| [`graph`](#graph) | Print the dependency graph as an ASCII tree (`--json` for raw). |
| [`dead-code`](#dead-code) | Report unused exports, orphan files, and duplicate candidates. |
| [`search`](#search) | Fuzzy-search every discovered asset. |
| [`watch`](#watch) | Re-analyze automatically (incrementally) on file changes. |

## Common options

These apply to most commands:

| Flag | Meaning |
| --- | --- |
| `-r, --root <dir>` | Project root to analyze (default: current directory). |
| `[root]` (positional) | Alternative to `--root`, e.g. `atlas serve ./app`. |
| `-o, --out-dir <dir>` | Output directory (default `.atlas`). |
| `--no-cache` | Disable the incremental cache for this run. |
| `--json` | Machine-readable JSON output (`graph`, `dead-code`, `search`). |
| `-v, --version` | Print the version. |

---

## `serve`

Analyze the project and serve the interactive dashboard locally. **Writes nothing
into your codebase** — caches under `~/.atlas/`.

```bash
atlas serve                       # current project, opens http://localhost:4321
atlas serve --root examples/sample-app
atlas serve --port 5000           # preferred port (falls back if busy)
atlas serve --no-open             # don't auto-open the browser
atlas serve --reanalyze           # ignore cached analysis and re-scan
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `-p, --port <n>` | `4321` | Preferred port; an OS-assigned free port is used if taken. |
| `--no-open` | (opens) | Do not auto-open the browser. |
| `--reanalyze` | (cached) | Force a fresh scan instead of loading the cache. |

> Requires the dashboard to be built (`dashboard/dist`). It ships prebuilt; if
> missing, build it with `npm run build:dashboard`.

---

## `export`

Emit a self-contained static bundle (the dashboard + a `data.json`) to an
**external** directory you can deploy anywhere. Refuses to write inside the
scanned project.

```bash
atlas export --out-dir ~/my-codebase-site
# then deploy that folder; the app fetches ./data.json at runtime
```

| Flag | Meaning |
| --- | --- |
| `-o, --out-dir <dir>` | Destination folder (must be outside the project). Defaults to `~/.atlas/cache/<hash>/site`. |
| `--reanalyze` | Ignore cached analysis and re-scan. |

See [Hosting & Deployment](hosting.md) for deploy targets.

---

## `analyze`

Scan the project and write JSON outputs into the project's `.atlas/` directory.
This is the only command that writes into your repo.

```bash
atlas analyze
atlas analyze --root ./packages/web --no-cache
```

Outputs:

```
.atlas/
├─ analysis.json     # full snapshot (used by other commands)
├─ components.json   ├─ contexts.json   ├─ graph.json
├─ hooks.json        ├─ routes.json     ├─ dead-code.json
├─ utils.json        ├─ architecture.json
└─ search.json
```

---

## `describe`

Generate or upgrade asset descriptions. By default descriptions are heuristic and
offline; `describe` lets you hand assets to a coding agent for richer text.

```bash
atlas describe                    # write a hand-off packet, print agent commands
atlas describe --agent claude     # auto-run an agent end-to-end (claude|codex|cursor)
atlas describe --apply            # merge an agent's descriptions.json into the analysis
atlas describe --heuristic        # (re)generate the offline descriptions instead
atlas describe --agent codex --no-run   # write the packet but don't invoke the agent
atlas describe --copy             # copy the agent instruction to the clipboard
```

| Flag | Meaning |
| --- | --- |
| `--agent <name>` | Agent to hand off to: `claude` \| `codex` \| `cursor`. |
| `--apply` | Fold an agent's `descriptions.json` back into the analysis. |
| `--heuristic` | Regenerate offline heuristic descriptions. |
| `--no-run` | Write the packet but do not invoke the agent. |
| `--copy` | Copy the agent instruction to the clipboard for a manual paste. |

The packet lives under `.atlas/handoff/`:

```
.atlas/handoff/
├─ PROMPT.md          # instructions + the exact answer schema for the agent
├─ assets.json        # every asset's id, kind, signature, props/params, usage
└─ descriptions.json  # ← the agent writes this (one rich description per id)
```

Each agent-authored description is tagged with its `source` (`claude` / `codex` /
`cursor`); skipped assets keep their heuristic description as a fallback.

---

## `graph`

Print the dependency graph.

```bash
atlas graph            # ASCII tree
atlas graph --json     # raw JSON
```

---

## `dead-code`

Report unused exports, orphan files, and duplicate candidates.

```bash
atlas dead-code
atlas dead-code --json
```

---

## `search`

Fuzzy-search every discovered asset (powered by Fuse.js).

```bash
atlas search authentication
atlas search useAuth --json --limit 5
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `-n, --limit <n>` | `20` | Max results. |
| `--json` | (pretty) | JSON output. |

Example:

```
● AuthContext   [context]
● AuthProvider  [component]
● useAuth       [hook]
● LoginScreen   [component]
```

---

## `watch`

Re-analyze automatically (incrementally) on file changes — useful while keeping a
dashboard or `.atlas/` outputs fresh during development.

```bash
atlas watch --root ./src
```
</content>
