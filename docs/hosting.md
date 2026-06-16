# Hosting & Deployment

Atlas's dashboard is a static React app that reads a single `data.json` at
runtime. You can run it three ways:

1. **Serve locally** (ephemeral, for your own machine) — `atlas serve`.
2. **Export a static bundle** and deploy it to any host — `atlas export`.
3. **Publish the CLI** itself to npm so others can `npx codebase-atlas`.

---

## Prerequisite: build the dashboard

The dashboard ships **prebuilt** in `dashboard/dist`. Both `serve` and `export`
require it. If it's missing (e.g. a fresh clone where you deleted it), build it:

```bash
npm run build:dashboard      # installs dashboard deps + vite build → dashboard/dist
```

To build everything (CLI + dashboard) at once:

```bash
npm run build:all            # tsc → dist/  AND  vite build → dashboard/dist
```

---

## Option 1 — Serve locally

The quickest way. Analyzes, caches under `~/.atlas/`, and serves at a local link.

```bash
atlas serve                  # http://localhost:4321
atlas serve --port 8080
atlas serve --no-open        # print the link, don't open a browser
atlas serve --reanalyze      # force a fresh scan
```

This is a long-running process (Ctrl+C to stop). The server is a dependency-free
Node `http` server bound to `127.0.0.1` — it is **not** exposed to your network.
Nothing is written into the scanned project.

---

## Option 2 — Export a static bundle (deploy anywhere)

`export` produces a self-contained folder: the dashboard assets + a `data.json`
snapshot. The app fetches `./data.json` at runtime, so the bundle is fully static
— no server logic required.

```bash
atlas export --out-dir ~/atlas-site
```

> The destination **must be outside** the scanned project — Atlas refuses to write
> into the codebase it analyzed.

Resulting folder:

```
~/atlas-site/
├─ index.html
├─ assets/        # JS/CSS bundles
└─ data.json      # the analysis snapshot
```

### Preview the bundle locally

```bash
npx serve ~/atlas-site
# or
atlas serve            # (serves the live analysis, not the exported snapshot)
```

### Deploy to common hosts

Because the bundle is static and uses **hash-based routing**, it works on any
static host with no SPA-rewrite configuration needed.

**Netlify**
```bash
netlify deploy --dir ~/atlas-site --prod
```

**Vercel**
```bash
vercel deploy ~/atlas-site --prod
```

**GitHub Pages**
```bash
# copy the bundle into a gh-pages branch / docs folder and push
cp -r ~/atlas-site/* ./docs-site/
git add docs-site && git commit -m "Publish Atlas dashboard"
# then enable Pages on that folder/branch in repo settings
```

**AWS S3 (static website)**
```bash
aws s3 sync ~/atlas-site s3://my-bucket --delete
# enable static website hosting on the bucket; index document = index.html
```

**nginx**
```nginx
server {
  listen 80;
  root /var/www/atlas-site;
  index index.html;
  # hash routing means no try_files rewrite is required, but it's harmless:
  location / { try_files $uri $uri/ /index.html; }
}
```

**Any container / CI:** the bundle is just static files — serve them with
`npx serve`, `python -m http.server`, Caddy, or copy into any web server's root.

### Keeping the deployed site fresh

`data.json` is a point-in-time snapshot. To update a deployed site, re-run
`atlas export --reanalyze` and redeploy the folder (e.g. as a CI step on merge to
`main`).

---

## Option 3 — Publish the CLI to npm

The package is configured to publish `dist/` and `dashboard/dist`:

```jsonc
// package.json
"files": ["dist", "dashboard/dist"],
"bin": { "atlas": "dist/index.js" },
"prepublishOnly": "npm run build:all"
```

To publish:

```bash
npm login
npm publish            # prepublishOnly builds CLI + dashboard automatically
```

Consumers then run it with zero install:

```bash
npx codebase-atlas serve
```

---

## Where data lives (and what's safe to commit)

| Location | Written by | Commit it? |
| --- | --- | --- |
| `.atlas/` in your repo | `analyze` | Optional — these are JSON reports. (`.gitignore`d by default.) |
| `~/.atlas/cache/<hash>/` | `serve`, `export` | No — per-user cache outside the repo. |
| `<out-dir>/` from `export` | `export` | This is your deployable artifact. |

`serve` and `export` never write into the scanned project. Only `analyze` does,
and `.atlas/` is in `.gitignore`.
</content>
