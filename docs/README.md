# Atlas — Contributor docs

**Using Atlas?** The user documentation — quickstart, every CLI command and
flag, configuration, dashboard views, outputs and hosting — lives on the site:
**https://yash-sakre.github.io/atlas/docs/** (source:
[`apps/site/content/docs`](../apps/site/content/docs)).

This folder is for people working **on** Atlas.

| Doc | What's inside |
| --- | --- |
| [Architecture](architecture.md) | How the analyzer is structured and how the pipeline works end to end. |
| [Development](development.md) | The monorepo layout; build, test, run the site, publish, and extend Atlas. |

## Key facts at a glance

- **Package name:** `codebase-atlas` · **Binary:** `atlas` · source in [`packages/cli`](../packages/cli)
- **Runtime:** Node.js `>=20`, CommonJS
- **Output types:** [`@codebase-atlas/schema`](../packages/schema), shared by the CLI and the dashboard
- **Dashboard:** React + Vite + Tailwind app in [`packages/dashboard`](../packages/dashboard), bundled into the CLI when it's packed
- **Website:** Next.js + Fumadocs in [`apps/site`](../apps/site)
- **No network / no API keys** required — descriptions are generated offline by default.
