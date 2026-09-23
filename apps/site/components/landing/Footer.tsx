'use client';

import Link from 'next/link';
import AtlasMark from './AtlasMark';
import { GITHUB_URL, NPM_URL, ISSUES_URL, LICENSE_URL } from '@/lib/shared';
import { useVisitorCount } from './useVisitorCount';

/** Renders nothing until the count resolves, and nothing at all if it fails. */
function VisitorCount() {
  const count = useVisitorCount();
  if (count === null) return <span className="visitors is-empty" aria-hidden />;
  return (
    <span className="visitors">
      <span className="visitors-dot" />
      <b>{count.toLocaleString('en-US')}</b> visitors
    </span>
  );
}

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="brand" href="/">
              <span className="logo"><AtlasMark size={30} /></span> Atlas
            </Link>
            <p>AST-powered discovery for frontend codebases. See what already exists before you build it again.</p>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <a href="#showcase">Showcase</a>
            <a href="#dashboard">Dashboard</a>
            <Link href="/docs">Docs</Link>
          </div>
          <div className="foot-col">
            <h4>Resources</h4>
            <Link href="/docs/hosting">Guides</Link>
            <a href={NPM_URL} target="_blank" rel="noopener">npm package</a>
            <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noopener">README</a>
          </div>
          <div className="foot-col">
            <h4>Community</h4>
            <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
            <a href={ISSUES_URL} target="_blank" rel="noopener">Issues</a>
            <a href={LICENSE_URL} target="_blank" rel="noopener">License</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Atlas · MIT License</span>
          <span className="hide-sm">Built for developers who hate rebuilding the same button.</span>
          <VisitorCount />
        </div>
      </div>
    </footer>
  );
}
