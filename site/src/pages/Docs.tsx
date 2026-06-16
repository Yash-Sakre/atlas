import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CommandBox from '../components/CommandBox';
import { COMMANDS, GLOBAL_OPTIONS, type Command } from '../data/commands';
import { INSTALL_CMD } from '../data/site';

function OptionsTable({ command }: { command: Command }) {
  if (command.options.length === 0) return null;
  return (
    <div className="opt-table">
      {command.options.map((o) => (
        <div className="opt-row" key={o.flag}>
          <code className="opt-flag">{o.flag}</code>
          <div className="opt-desc">
            {o.desc}
            {o.default && <span className="opt-default"> Default: <code>{o.default}</code></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandSection({ command }: { command: Command }) {
  return (
    <section className="doc-cmd" id={command.id}>
      <h2>{command.name}</h2>
      <pre className="signature mono">{command.signature}</pre>
      <p className="doc-desc">{command.description}</p>

      <h3 className="doc-sub">Options</h3>
      {command.options.length > 0 ? (
        <OptionsTable command={command} />
      ) : (
        <p className="doc-muted">Takes the common <code>--root</code> and <code>--out-dir</code> options only.</p>
      )}

      <h3 className="doc-sub">Examples</h3>
      <div className="examples">
        {command.examples.map((ex) => (
          <div className="example" key={ex.cmd}>
            <CommandBox command={ex.cmd} />
            {ex.note && <span className="example-note">{ex.note}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Docs() {
  const [active, setActive] = useState<string>(COMMANDS[0].id);

  // Highlight the sidebar entry for whichever command is in view.
  useEffect(() => {
    const ids = ['install', ...COMMANDS.map((c) => c.id), 'global-options'];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <main className="docs">
      <div className="wrap docs-grid">
        <aside className="docs-side">
          <div className="docs-side-inner">
            <span className="docs-side-label">Getting started</span>
            <Link to={{ pathname: '/docs', hash: '#install' }} className={active === 'install' ? 'is-active' : ''}>
              Installation
            </Link>
            <span className="docs-side-label">Commands</span>
            {COMMANDS.map((c) => (
              <Link
                key={c.id}
                to={{ pathname: '/docs', hash: `#${c.id}` }}
                className={active === c.id ? 'is-active' : ''}
              >
                {c.name}
              </Link>
            ))}
            <span className="docs-side-label">Reference</span>
            <Link
              to={{ pathname: '/docs', hash: '#global-options' }}
              className={active === 'global-options' ? 'is-active' : ''}
            >
              Global options
            </Link>
          </div>
        </aside>

        <div className="docs-main">
          <header className="docs-head">
            <span className="eyebrow">Documentation</span>
            <h1>Command reference</h1>
            <p className="lead">
              Atlas ships a single CLI. Every command works zero-config from any project root — pass a path,
              or run it where your code lives.
            </p>
          </header>

          <section className="doc-cmd" id="install">
            <h2>Installation</h2>
            <p className="doc-desc">
              No install required — run it on demand with <code>npx</code>. The fastest path is{' '}
              <code>serve</code>, which analyzes the current project and opens the dashboard.
            </p>
            <div className="examples">
              <div className="example">
                <CommandBox command={INSTALL_CMD} />
                <span className="example-note">Run in any React / Next.js / Vite / TypeScript project.</span>
              </div>
              <div className="example">
                <CommandBox command="npm i -g codebase-atlas" />
                <span className="example-note">Or install globally to use the <code>atlas</code> binary directly.</span>
              </div>
            </div>
          </section>

          {COMMANDS.map((c) => (
            <CommandSection command={c} key={c.id} />
          ))}

          <section className="doc-cmd" id="global-options">
            <h2>Global options</h2>
            <p className="doc-desc">Available on the root command and every subcommand.</p>
            <div className="opt-table">
              {GLOBAL_OPTIONS.map((o) => (
                <div className="opt-row" key={o.flag}>
                  <code className="opt-flag">{o.flag}</code>
                  <div className="opt-desc">{o.desc}</div>
                </div>
              ))}
            </div>
            <h3 className="doc-sub">Common analysis options</h3>
            <p className="doc-muted">
              Most analysis commands also accept <code>-r, --root &lt;dir&gt;</code> (project root, defaults
              to the current directory and may be passed positionally) and{' '}
              <code>-o, --out-dir &lt;dir&gt;</code> (output / cache directory, defaults to{' '}
              <code>.atlas</code>).
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
