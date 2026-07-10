import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  FiGrid,
  FiBox,
  FiZap,
  FiTool,
  FiDatabase,
  FiGitBranch,
  FiDroplet,
  FiPackage,
  FiAlertTriangle,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import AtlasMark from './components/AtlasMark';
import { useData } from './data';
import type { Stats } from './types';

type NavItem = { to: string; label: string; icon: IconType; count?: keyof Stats };

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: FiGrid },
  { to: '/components', label: 'Components', icon: FiBox, count: 'components' },
  { to: '/hooks', label: 'Hooks', icon: FiZap, count: 'hooks' },
  { to: '/utils', label: 'Utils', icon: FiTool, count: 'utils' },
  { to: '/contexts', label: 'Contexts', icon: FiDatabase, count: 'contexts' },
  { to: '/routes', label: 'Routes', icon: FiGitBranch, count: 'routes' },
  { to: '/design', label: 'Design', icon: FiDroplet, count: 'designTokens' },
  { to: '/dependencies', label: 'Dependencies', icon: FiPackage, count: 'dependencies' },
  { to: '/dead-code', label: 'Dead code', icon: FiAlertTriangle, count: 'unusedExports' },
];

/** Routes that fill the viewport (no page scroll) — the master/detail browsers. */
const FILL = new Set(['/components', '/hooks', '/utils', '/contexts', '/routes']);

/** Table pages that fill the viewport — head/filters pinned, the body scrolls.
 *  Dead code shows one category at a time (tabbed), so a single body scrolls
 *  rather than the whole page. */
const SHEET = new Set(['/dependencies', '/dead-code']);

/** Last path segment, e.g. "/home/yash/Repo/chat-pdf" → "chat-pdf". */
function folderName(p: string): string {
  if (!p) return p;
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export default function Layout() {
  const { pathname } = useLocation();
  const fill = FILL.has(pathname);
  const sheet = SHEET.has(pathname);
  const data = useData();
  const s = data.stats;

  return (
    <div className="atlas-body atlas-shell">
      <aside className="atlas-sidebar">
        <Link to="/" className="atlas-brand">
          <span className="atlas-brand-glyph">
            <AtlasMark size={32} />
          </span>
          <span>
            <span className="atlas-brand-name">Atlas</span>
            <span className="atlas-brand-sub">Codebase map</span>
          </span>
        </Link>

        <p className="atlas-nav-label">Browse</p>
        <nav className="atlas-snav">
          {NAV.map(({ to, label, icon: Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `atlas-snav-link${isActive ? ' is-active' : ''}`}
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
              {count != null && <span className="atlas-snav-count tnum">{s[count]}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="atlas-sidebar-spacer" />

        <div className="atlas-sidebar-foot">
          <div className="atlas-foot-row">
            <span className="atlas-foot-key">Project</span>
            <span className="atlas-foot-val atlas-trunc mono" title={data.meta.root}>
              {folderName(data.meta.root)}
            </span>
          </div>
          <div className="atlas-foot-row">
            <span className="atlas-foot-key">Files</span>
            <span className="atlas-foot-val tnum">{s.fileCount}</span>
          </div>
          <div className="atlas-foot-row">
            <span className="atlas-foot-key">Version</span>
            <span className="atlas-foot-val mono">{data.meta.toolVersion}</span>
          </div>
        </div>
      </aside>

      <main
        className={`atlas-content${fill ? ' atlas-content--fill' : ''}${
          sheet ? ' atlas-content--sheet' : ''
        }`}
      >
        <div className="atlas-view">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
