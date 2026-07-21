/**
 * Docs shell: grouped sidebar on the left, the routed page in the middle, an
 * auto-generated "On this page" rail on the right, and prev/next paging at the
 * bottom. The rail is built by scraping `[data-toc]` headings out of the
 * rendered page, so pages never have to declare their own TOC.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DOCS_GROUPS, DOCS_FLAT, neighbors, type DocsEntry } from '../data/docsNav';
import { anchorHref } from './ui';

/* -------------------------------- sidebar -------------------------------- */

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="docs-nav">
      {DOCS_GROUPS.map((g) => (
        <div className="docs-group" key={g.label}>
          <span className="docs-group-label">{g.label}</span>
          {g.entries.map((e) => (
            <NavLink
              key={e.path}
              to={e.path}
              className={({ isActive }) => (isActive ? 'docs-link is-active' : 'docs-link')}
              onClick={onNavigate}
            >
              {e.title}
              {e.isNew && <span className="tag-new inline">New</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ on this page ------------------------------ */

type TocItem = { id: string; text: string; level: number };

function useHeadings(pathname: string): TocItem[] {
  const [items, setItems] = useState<TocItem[]>([]);
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.docs-body [data-toc]');
    setItems(
      Array.from(nodes).map((n) => ({
        id: n.id,
        // Strip the trailing anchor glyph that the heading renders.
        text: (n.textContent ?? '').replace(/[#✓]\s*$/, '').trim(),
        level: Number(n.dataset.toc ?? 2),
      })),
    );
  }, [pathname]);
  return items;
}

function Toc({ items, pathname }: { items: TocItem[]; pathname: string }) {
  const [active, setActive] = useState<string>('');
  const ids = items.map((i) => i.id).join(',');

  useEffect(() => {
    if (!ids) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    ids.split(',').forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);

  if (items.length < 2) return <aside className="docs-toc" />;

  return (
    <aside className="docs-toc">
      <div className="docs-toc-inner">
        <span className="docs-toc-label">On this page</span>
        {items.map((i) => (
          <a
            key={i.id}
            href={anchorHref(pathname, i.id)}
            className={`toc-link lvl-${i.level} ${active === i.id ? 'is-active' : ''}`}
          >
            {i.text}
          </a>
        ))}
      </div>
    </aside>
  );
}

/* --------------------------------- pager --------------------------------- */

function Pager({ prev, next }: { prev?: DocsEntry; next?: DocsEntry }) {
  if (!prev && !next) return null;
  return (
    <nav className="pager">
      {prev ? (
        <Link to={prev.path} className="pager-item prev">
          <span>← Previous</span>
          <b>{prev.title}</b>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.path} className="pager-item next">
          <span>Next →</span>
          <b>{next.title}</b>
        </Link>
      )}
    </nav>
  );
}

/* --------------------------------- shell --------------------------------- */

export default function DocsLayout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = useHeadings(pathname);
  const { prev, next } = neighbors(pathname);
  const current = DOCS_FLAT.find((e) => e.path === pathname);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <main className="docs">
      <div className="wrap docs-shell">
        <aside className="docs-side">
          <div className="docs-side-inner">
            <SidebarNav />
          </div>
        </aside>

        <div className="docs-main">
          <button
            className="docs-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            <span>{current?.title ?? 'Documentation'}</span>
            <span className={`chev ${mobileOpen ? 'up' : ''}`}>⌄</span>
          </button>
          {mobileOpen && (
            <div className="docs-mobile-nav">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          )}

          <div className="docs-body" ref={bodyRef}>
            <Outlet />
          </div>

          <Pager prev={prev} next={next} />
        </div>

        <Toc items={items} pathname={pathname} />
      </div>
    </main>
  );
}
