# Atlas — Documentation

**Atlas** (`codebase-atlas`) scans a React / Next.js / Vite / TypeScript codebase
and automatically **discovers, analyzes, and documents every reusable asset** —
components, hooks, utilities, contexts/stores, and routes — so a developer can see
what already exists *before* writing new code.

Everything is detected by **AST semantics, never folder names**, using
[`ts-morph`](https://ts-morph.com). The output is JSON plus an interactive React
dashboard you can serve locally or deploy as a static site.

## Documentation index

| Doc | What's inside |
| --- | --- |
| [Architecture](architecture.md) | How the project is structured and how the analysis pipeline works end to end. |
| [Commands](commands.md) | Full CLI reference — every command, flag, and example. |
| [Hosting & Deployment](hosting.md) | How to serve locally and deploy the dashboard to any static host. |
| [Development](development.md) | Build, test, and extend Atlas (plugin system). |

## 30-second start

```bash
# Analyze the current project and open the dashboard in your browser
npx codebase-atlas serve

# Try it against the bundled demo app
npx codebase-atlas serve --root examples/sample-app
```

Nothing is written into your codebase — analysis is cached under `~/.atlas/`.

## Key facts at a glance

- **Package name:** `codebase-atlas` · **Binary:** `atlas`
- **Runtime:** Node.js `>=18`, CommonJS
- **Language:** TypeScript (compiled to `dist/` via `tsc`)
- **Dashboard:** React + Vite + Tailwind app in [`dashboard/`](../dashboard) (ships prebuilt in `dashboard/dist`)
- **No network / no API keys** required — descriptions are generated offline by default.
</content>
</invoke>
