import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { Button } from '@/components/ui/button';

const NAV: Array<[string, string]> = [
  ['/', 'Overview'],
  ['/components', 'Components'],
  ['/hooks', 'Hooks'],
  ['/utils', 'Utils'],
  ['/contexts', 'Contexts'],
  ['/routes', 'Routes'],
];

/** Routes that use the fixed-viewport app-shell (no page scroll, no footer). */
const APP_SHELL = new Set(['/components', '/hooks', '/utils', '/contexts']);

function Logo() {
  return <FiSearch size={18} strokeWidth={2.2} aria-hidden="true" />;
}

export default function Layout() {
  const { pathname } = useLocation();
  const appShell = APP_SHELL.has(pathname);

  return (
    <div className={`atlas-body${appShell ? ' atlas-body--app' : ''}`}>
      <header className="atlas-topnav">
        <div className="atlas-topnav-inner">
          <Link to="/" className="atlas-wordmark">
            <span className="atlas-wordmark-glyph">
              <Logo />
            </span>
            <span>Atlas</span>
          </Link>
          <nav className="atlas-nav">
            {NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `atlas-nav-link${isActive ? ' is-active' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="atlas-nav-cta">
            <Button asChild variant="primary" size="sm">
              <Link to="/">Overview</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={`atlas-main${appShell ? ' atlas-main--app' : ''}`}>
        <Outlet />
      </main>

      {!appShell && (
        <footer className="atlas-footer">
          <div className="atlas-footer-inner">
            <div className="atlas-footer-brand">
              <span className="atlas-wordmark-glyph">
                <Logo />
              </span>
              <span>Atlas</span>
            </div>
            <nav className="atlas-footer-nav">
              {NAV.map(([to, label]) => (
                <Link key={to} to={to} className="atlas-foot-link">
                  {label}
                </Link>
              ))}
            </nav>
            <p className="atlas-footer-meta">Auto-generated documentation &middot; React dashboard</p>
          </div>
        </footer>
      )}
    </div>
  );
}
