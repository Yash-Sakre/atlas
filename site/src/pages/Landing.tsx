import { Link } from 'react-router-dom';
import CommandBox from '../components/CommandBox';
import GitHubButton from '../components/GitHubButton';
import Terminal from '../components/Terminal';
import { INSTALL_CMD } from '../data/site';
import { COMMANDS } from '../data/commands';

export default function Landing() {
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
            components, hooks, utilities, contexts, stores &amp; routes. Detected by <b>AST semantics</b>,
            never by folder names.
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
              <p>Search, asset detail, props / params, and usage locations — served at a local link.</p>
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
                <span style={{ color: 'var(--muted)' }}>unused exports · 2 orphans · dup candidates flagged.</span>
              </p>
            </div>
            <div className="tile t-3 t-wide-sm">
              <div className="ico">📦</div>
              <h3>Monorepo aware</h3>
              <p>npm / yarn / pnpm workspaces, Turborepo &amp; Nx auto-detected. Routers resolve per workspace.</p>
            </div>
            <div className="tile t-3 t-wide-sm">
              <div className="ico">🫧</div>
              <h3>Zero footprint</h3>
              <p>
                Caches under <code>~/.atlas/</code> — nothing is written into your repo. Run{' '}
                <code>atlas export</code> for a static bundle to host anywhere.
              </p>
            </div>
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
              See the <Link to="/docs" className="accent">full command reference →</Link>
            </p>
          </div>
          <div className="qs">
            {COMMANDS.map((c) => (
              <Link to="/docs" key={c.id} className="qs-item">
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
