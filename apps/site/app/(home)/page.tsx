import type { Metadata } from 'next';
import Link from 'next/link';
import CommandBox from '@/components/landing/CommandBox';
import GitHubButton from '@/components/landing/GitHubButton';
import Terminal from '@/components/landing/Terminal';
import { INSTALL_CMD } from '@/lib/shared';
import { COMMANDS } from '@/lib/data/commands';
import { DASHBOARD_VIEWS, OUTPUT_FILES } from '@/lib/data/features';

export const metadata: Metadata = {
  title: { absolute: 'Atlas — map every reusable asset in your frontend codebase' },
};

export default function HomePage() {
  return (
    <main>
      <header id="top">
        <div className="wrap">
          <span className="pill">
            <span className="live" /> Zero config · <b>npx codebase-atlas</b>
          </span>
          <h1>
            Your codebase already <span className="accent">has it</span>. Atlas finds it.
          </h1>
          <p className="sub">
            One scan maps every reusable asset across your React / Next.js / Vite / TypeScript codebase —
            components, hooks, utilities, contexts, stores &amp; routes — plus your{' '}
            <b>npm inventory</b>, <b>static assets</b>, <b>architecture</b> and the code nothing uses any
            more. Detected by <b>AST semantics</b>, never by folder names.
          </p>
          <div className="actions">
            <CommandBox command={INSTALL_CMD} />
            <GitHubButton variant="primary" label="View on GitHub" />
          </div>
          <div className="trust">
            <span>⚡ Runs in seconds</span>
            <span>🔒 Offline by default</span>
            <span>📦 Monorepo aware</span>
            <span>📄 MIT licensed</span>
          </div>
          <Terminal />
        </div>
      </header>

      {/* showcase */}
      <section id="showcase">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Showcase</span>
            <h2>Everything a new dev needs, from one scan.</h2>
            <p className="lead">
              Storybook + Compodoc + Madge, auto-generated — read straight from the AST, so it works in a
              tidy design system or a messy monorepo alike.
            </p>
          </div>
          <div className="bento">
            <div className="tile t-4 t-wide-sm">
              <div className="ico">🧠</div>
              <h3>Semantic AST detection</h3>
              <p>
                Assets are classified by what the code <em>does</em>, resolved through the TypeScript type
                checker — not by where the file lives.
              </p>
              <pre className="mini mono">
{`// useCart.ts
hook     useCart        → returns { items, add }
util     formatPrice    → pure · formatter
store    cartStore      → zustand · create()`}
              </pre>
            </div>
            <div className="tile t-2">
              <div className="ico">🧩</div>
              <h3>6 asset kinds</h3>
              <p>One classifier, every reusable primitive in your app.</p>
              <div className="chips">
                {[
                  ['Components', 'component'],
                  ['Hooks', 'hook'],
                  ['Utils', 'utility'],
                  ['Contexts', 'context'],
                  ['Stores', 'store'],
                  ['Routes', 'route'],
                ].map(([label, kind]) => (
                  <span className={`chip chip--${kind}`} key={kind}>{label}</span>
                ))}
              </div>
            </div>
            <div className="tile t-2 spotlight sp-violet">
              <div className="ico">🗺️</div>
              <h3>Interactive dashboard</h3>
              <p>Eight views over one scan — search, asset detail, routes, graph, dependencies, static assets, dead code.</p>
            </div>
            <div className="tile t-2">
              <div className="ico">🔗</div>
              <h3>Dependency graph</h3>
              <pre className="mini mono">
{`Button
├─ Icon
└─ Spinner
   └─ cn()`}
              </pre>
            </div>
            <div className="tile t-2">
              <div className="ico">🧹</div>
              <h3>Dead-code &amp; duplicates</h3>
              <p>
                <span className="stat">3</span>{' '}
                <span style={{ color: 'var(--ink-muted)' }}>unused exports · 2 orphans · dup candidates flagged.</span>
              </p>
            </div>

            <div className="tile t-3 t-wide-sm spotlight sp-magenta">
              <span className="tag-new">New</span>
              <div className="ico">📦</div>
              <h3>Every dependency, accounted for</h3>
              <p>
                Each package you declare, with the version actually installed, how many files import it, and
                a live update check against the registry. Local <code>file:</code>, <code>workspace:</code>{' '}
                and git installs are labelled as such instead of guessed at — so “is this still used?” and
                “what's behind?” are one screen, not an afternoon.
              </p>
            </div>

            <div className="tile t-3 t-wide-sm spotlight sp-coral">
              <span className="tag-new">New</span>
              <div className="ico">🖼️</div>
              <h3>Static assets, not just source</h3>
              <p>
                Every image, font, media clip and PDF you ship — with its size, the dimensions read straight
                from the file header, and every reference from code, stylesheets and markup. Previews stream
                from the real path on disk, so nothing leaves your project. The 4&nbsp;MB hero nobody imports
                shows up on the first scan.
              </p>
            </div>

            <div className="tile t-2">
              <div className="ico">🏛️</div>
              <h3>Architecture insights</h3>
              <p>
                Module boundaries, the shared layer, and the cross-imports that violate them — each with a
                concrete recommendation.
              </p>
            </div>
            <div className="tile t-2">
              <div className="ico">🗂️</div>
              <h3>Monorepo aware</h3>
              <p>
                npm / yarn / pnpm workspaces, Turborepo &amp; Nx auto-detected. Path aliases resolve per
                workspace, including split <code>tsconfig</code> setups.
              </p>
            </div>
            <div className="tile t-2">
              <div className="ico">🫧</div>
              <h3>Self-contained</h3>
              <p>
                Everything lands in one gitignorable <code>.atlas/</code> folder. Run{' '}
                <code>atlas export</code> for a static bundle to host anywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* dashboard tour */}
      <section id="dashboard">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">The dashboard</span>
            <h2>Eight views. One scan. No config.</h2>
            <p className="lead">
              <code>atlas serve</code> analyzes the project and opens a local React app. Every view reads the
              same snapshot, so nothing is ever stale relative to anything else.
            </p>
          </div>
          <div className="views">
            {DASHBOARD_VIEWS.map((v) => (
              <div className="view" key={v.id}>
                <span className="view-ico">{v.icon}</span>
                <div>
                  <h3>
                    {v.name}
                    {v.isNew && <span className="tag-new inline">New</span>}
                  </h3>
                  <p>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* outputs */}
      <section id="outputs">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Outputs</span>
            <h2>Structured data, not just a pretty page.</h2>
            <p className="lead">
              Every run writes a plain-JSON snapshot to <code>.atlas/</code>. Diff it in CI, gate a pipeline
              on it, or feed it to your own tooling.{' '}
              <Link href="/docs/outputs" className="accent">
                See the full output reference →
              </Link>
            </p>
          </div>
          <div className="files">
            {OUTPUT_FILES.map((f) => (
              <div className="file" key={f.file}>
                <code className={f.isNew ? 'is-new' : ''}>{f.file}</code>
                <span>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI */}
      <section id="ai">
        <div className="wrap">
          <div className="ai">
            <div>
              <span className="eyebrow">AI, on your terms</span>
              <h2>Useful with AI. Complete without it.</h2>
              <p className="lead">
                Atlas writes structured, accurate descriptions for every asset offline — no API keys, no
                network calls, no data leaving your machine. When you want richer prose, hand the same assets
                to an agent.
              </p>
              <ul>
                <li>
                  <span className="mk">›</span>
                  <span><b>Offline-first descriptions</b> — generated from real AST facts, so they never hallucinate signatures.</span>
                </li>
                <li>
                  <span className="mk">›</span>
                  <span><b>Optional handoff</b> — <code>atlas describe</code> pipes assets to Claude, Codex or Cursor for deeper docs.</span>
                </li>
                <li>
                  <span className="mk">›</span>
                  <span><b>Agent-ready context</b> — a clean map of what already exists, so your coding agent reuses instead of reinventing.</span>
                </li>
              </ul>
            </div>
            <div className="panel">
              <div className="head">atlas describe — agent handoff</div>
              <pre className="body mono">
{`$ atlas describe --agent claude
→ Sending 18 assets with AST context…
✓ Button       A11y-ready button, 4 variants
✓ useDebounce  Delays a value by N ms
✓ AuthContext  Session + role state
⚠ No keys needed for the default offline pass`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* quick start */}
      <section id="start">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Quick start</span>
            <h2>One command. The whole toolbox.</h2>
            <p className="lead">
              Point Atlas at any project and it analyzes, caches, and serves — no setup, nothing committed.
              See the <Link href="/docs/cli/serve" className="accent">full command reference →</Link>
            </p>
          </div>
          <div className="qs">
            {COMMANDS.map((c) => (
              <Link href={`/docs/cli/${c.id}`} key={c.id} className="qs-item">
                <span className="n">{c.name}</span>
                <p>{c.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="cta">
        <div className="wrap">
          <div className="box">
            <span className="eyebrow">Get started</span>
            <h2>Map your codebase in seconds.</h2>
            <p className="lead center" style={{ margin: '0 auto' }}>
              No config. Nothing written into your repo. Open source under MIT.
            </p>
            <div className="actions">
              <CommandBox command={INSTALL_CMD} />
              <GitHubButton variant="primary" label="★ Star on GitHub" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
