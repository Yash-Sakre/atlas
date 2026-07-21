/** Shared building blocks for the docs pages: headings, tables, code, callouts. */
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The app runs on HashRouter, so the URL hash is the route. An in-page anchor
 * therefore has to be addressed as `#<route>#<id>` — react-router parses
 * everything after the first `#` as path + hash.
 */
export function anchorHref(pathname: string, id: string): string {
  return `#${pathname}#${id}`;
}

/* ------------------------------ page header ------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  lead,
  signature,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  /** Optional usage line, shown for CLI command pages. */
  signature?: string;
}) {
  return (
    // A signature means this is a CLI command page — the title is then set in
    // the mono face, so `atlas dead-code` reads as a command, not as prose.
    <header className={signature ? 'doc-head is-cmd' : 'doc-head'}>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="doc-lead">{lead}</p>
      {signature && (
        <>
          <span className="doc-usage-label">Usage</span>
          <pre className="signature mono">{signature}</pre>
        </>
      )}
    </header>
  );
}

/* ------------------------------- headings -------------------------------- */

function AnchorLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    const base = window.location.href.split('#')[0];
    navigator.clipboard?.writeText(`${base}${anchorHref(pathname, id)}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
    // Move the URL to the section too, so the browser's own copy-address works.
    navigate({ hash: `#${id}` }, { replace: true });
  };

  return (
    <a
      href={anchorHref(pathname, id)}
      className="doc-anchor"
      onClick={copy}
      aria-label={`Copy link to ${id}`}
      title="Copy link to this section"
    >
      {copied ? '✓' : '#'}
    </a>
  );
}

/** Section heading with a copyable deep link. Registered in the page TOC. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 className="doc-h doc-h2" id={id} data-toc="2">
      {children}
      <AnchorLink id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 className="doc-h doc-h3" id={id} data-toc="3">
      {children}
      <AnchorLink id={id} />
    </h3>
  );
}

/** Small uppercase label for sub-blocks that don't deserve a TOC entry. */
export function Label({ children }: { children: ReactNode }) {
  return <p className="doc-label">{children}</p>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="doc-p">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="doc-lead">{children}</p>;
}

/* -------------------------------- tables --------------------------------- */

export type Row = {
  /** Left column — rendered monospace. */
  term: string;
  /** Optional dim annotation next to the term (a type, a badge). */
  meta?: string;
  desc: ReactNode;
  isNew?: boolean;
  accent?: boolean;
};

export function DefTable({ rows }: { rows: Row[] }) {
  return (
    <div className="def-table">
      {rows.map((r) => (
        <div className="def-row" key={r.term}>
          <div className="def-term">
            <code className={r.accent ? 'is-accent' : undefined}>{r.term}</code>
            {r.meta && <span className="def-meta">{r.meta}</span>}
            {r.isNew && <span className="tag-new inline">New</span>}
          </div>
          <div className="def-desc">{r.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- code ---------------------------------- */

export function CodeBlock({ children, caption }: { children: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <figure className="code-fig">
      <div className="code-bar">
        <span>{caption ?? 'example'}</span>
        <button className="code-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-body mono">{children}</pre>
    </figure>
  );
}

/* ------------------------------- callouts -------------------------------- */

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: 'note' | 'tip' | 'warn';
  title?: string;
  children: ReactNode;
}) {
  const icon = kind === 'tip' ? '✦' : kind === 'warn' ? '!' : 'i';
  return (
    <aside className={`callout callout--${kind}`}>
      <span className="callout-ico" aria-hidden>
        {icon}
      </span>
      <div>
        {title && <b>{title}</b>}
        <div>{children}</div>
      </div>
    </aside>
  );
}

/* --------------------------------- lists --------------------------------- */

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="doc-bullets">{children}</ul>;
}

/** Numbered step with a heading — used by the quickstart. */
export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="step">
      <span className="step-n">{n}</span>
      <div className="step-body">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
