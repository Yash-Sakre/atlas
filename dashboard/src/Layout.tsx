import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  FiGrid,
  FiBox,
  FiZap,
  FiTool,
  FiDatabase,
  FiGitBranch,
  FiPackage,
  FiImage,
  FiAlertTriangle,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import AtlasMark from './components/AtlasMark';
import { useData } from './data';
import type { Stats } from './types';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: IconType; count?: keyof Stats };

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: FiGrid },
  { to: '/components', label: 'Components', icon: FiBox, count: 'components' },
  { to: '/hooks', label: 'Hooks', icon: FiZap, count: 'hooks' },
  { to: '/utils', label: 'Utils', icon: FiTool, count: 'utils' },
  { to: '/contexts', label: 'Contexts', icon: FiDatabase, count: 'contexts' },
  { to: '/routes', label: 'Routes', icon: FiGitBranch, count: 'routes' },
  { to: '/assets', label: 'Assets', icon: FiImage, count: 'staticAssets' },
  { to: '/dependencies', label: 'Dependencies', icon: FiPackage, count: 'dependencies' },
  { to: '/dead-code', label: 'Dead code', icon: FiAlertTriangle, count: 'unusedExports' },
];

/** Routes that fill the viewport (no page scroll) — the master/detail browsers. */
const FILL = new Set(['/components', '/hooks', '/utils', '/contexts', '/routes']);

/** Table pages that fill the viewport — head/filters pinned, the body scrolls.
 *  Dead code shows one category at a time (tabbed), so a single body scrolls
 *  rather than the whole page. */
const SHEET = new Set(['/dependencies', '/dead-code', '/assets']);

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
    <div className="grid h-screen grid-cols-[256px_minmax(0,1fr)] overflow-hidden font-body text-[14px] leading-[1.45] tracking-[-0.011em] text-ink max-[900px]:h-auto max-[900px]:min-h-screen max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <aside className="flex min-h-0 flex-col bg-linear-to-b from-[#100f0d] to-canvas px-3.5 py-[18px] max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-40 max-[900px]:h-auto max-[900px]:flex-row max-[900px]:items-center max-[900px]:gap-2 max-[900px]:overflow-x-auto max-[900px]:bg-[color-mix(in_srgb,var(--color-canvas)_86%,transparent)] max-[900px]:px-3.5 max-[900px]:py-2.5 max-[900px]:backdrop-blur-[12px] max-[900px]:backdrop-saturate-[1.4]">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2 pt-1.5 pb-[18px] text-ink no-underline max-[900px]:px-0 max-[900px]:pr-1 max-[900px]:py-0"
        >
          <span className="inline-grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md text-ink [&>svg]:block">
            <AtlasMark size={32} />
          </span>
          <span>
            <span className="font-display text-[16px] leading-none font-semibold tracking-[-0.02em]">
              Atlas
            </span>
            <span className="mt-[3px] block text-[11px] tracking-normal text-ink-faint max-[900px]:hidden">
              Codebase map
            </span>
          </span>
        </Link>

        <p className="mt-1.5 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.07em] text-ink-faint uppercase max-[900px]:hidden">
          Browse
        </p>
        <nav className="flex flex-col gap-0.5 max-[900px]:flex-row max-[900px]:gap-1">
          {NAV.map(({ to, label, icon: Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-[11px] rounded-md border border-transparent px-2.5 py-2 text-[13.5px] font-medium tracking-[-0.01em] no-underline transition-colors duration-[130ms] [&>svg]:shrink-0 [&>svg]:transition-colors max-[900px]:px-2.5 max-[900px]:py-[7px] max-[900px]:whitespace-nowrap',
                  isActive
                    ? 'bg-surface-2 text-ink [&>svg]:text-accent'
                    : 'text-ink-muted hover:bg-surface-1 hover:text-ink [&>svg]:text-ink-faint hover:[&>svg]:text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                  {count != null && (
                    <span
                      className={cn(
                        'ml-auto min-w-6 rounded-full px-[7px] py-px text-center text-[12px] tabular-nums',
                        isActive ? 'bg-surface-3 text-ink-muted' : 'bg-surface-1 text-ink-faint',
                      )}
                    >
                      {s[count]}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="min-h-3 flex-auto max-[900px]:hidden" />

        <div className="flex flex-col gap-2 border-t border-hairline-soft px-2.5 pt-3.5 pb-1 max-[900px]:hidden">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="shrink-0 text-[11px] text-ink-faint">Project</span>
            <span
              className="min-w-0 truncate text-right font-mono text-[11.5px] tracking-normal text-ink-muted"
              title={data.meta.root}
            >
              {folderName(data.meta.root)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="shrink-0 text-[11px] text-ink-faint">Files</span>
            <span className="min-w-0 text-right text-[11.5px] tabular-nums text-ink-muted">
              {s.fileCount}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="shrink-0 text-[11px] text-ink-faint">Version</span>
            <span className="min-w-0 text-right font-mono text-[11.5px] tracking-normal text-ink-muted">
              {data.meta.toolVersion}
            </span>
          </div>
        </div>
      </aside>

      <main
        className={cn(
          'min-w-0 overscroll-contain max-[900px]:h-auto max-[900px]:overflow-visible',
          fill || sheet ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        <div
          className={cn(
            'px-[clamp(20px,3.4vw,40px)]',
            fill || sheet
              ? 'flex h-full min-h-0 flex-col pt-7 pb-7 max-[900px]:h-auto'
              : 'pt-7 pb-16',
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
