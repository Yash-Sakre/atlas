import { useCallback, useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpen,
  FolderSimple,
  GithubLogo,
  List as ListIcon,
  MagnifyingGlass,
  SidebarSimple,
} from '@phosphor-icons/react';
import AtlasMark from './components/AtlasMark';
import CommandMenu from './components/CommandMenu';
import { useData } from './data';
import { NAV_GROUPS, DOCS_URL, REPO_URL, navFor } from './nav';
import { folderName, timeAgo, formatTime } from './ui';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/** Routes that fill the viewport (no page scroll) — the master/detail browsers
 *  and the table sheets, whose own bodies scroll instead. */
const FILL = new Set([
  '/components',
  '/hooks',
  '/utils',
  '/contexts',
  '/routes',
  '/dependencies',
  '/dead-code',
  '/assets',
]);

const COLLAPSE_KEY = 'atlas:sidebar-collapsed';
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Layout() {
  const { pathname } = useLocation();
  const fill = FILL.has(pathname);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* non-persistent is fine */
      }
      return !c;
    });
  }, []);

  // ⌘K / Ctrl+K opens the palette; `[` toggles the sidebar (outside inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!typing && e.key === '[' && !e.metaKey && !e.ctrlKey) toggleCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const current = navFor(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas font-body text-[14px] leading-normal text-ink max-[900px]:h-auto max-[900px]:min-h-screen max-[900px]:flex-col max-[900px]:overflow-visible">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 60 : 256 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        className="relative z-20 flex shrink-0 flex-col overflow-hidden bg-sidebar shadow-[inset_-1px_0_0_var(--color-hairline-soft)] max-[900px]:hidden"
      >
        <SidebarBody
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onSearch={() => setCmdOpen(true)}
        />
      </motion.aside>

      {/* ── Mobile top bar + drawer ── */}
      <div className="sticky top-0 z-30 hidden h-13 items-center gap-2 bg-canvas/85 px-3 shadow-[inset_0_-1px_0_var(--color-hairline-soft)] backdrop-blur-md max-[900px]:flex">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
          <ListIcon size={18} />
        </Button>
        <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium">
          <current.icon size={16} className="text-ink-faint" />
          <span className="truncate">{current.label}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setCmdOpen(true)}>
            <MagnifyingGlass size={17} />
          </Button>
          <ThemeSwitcher variant="menu" />
        </div>
      </div>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent side="left" className="bg-sidebar" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">Pages in this dashboard</DialogDescription>
          <SidebarBody
            collapsed={false}
            onSearch={() => {
              setDrawerOpen(false);
              setCmdOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Page ── */}
      <main
        className={cn(
          'min-w-0 flex-1 overscroll-contain max-[900px]:overflow-visible',
          fill ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'mx-auto w-full max-w-[1480px] px-[clamp(16px,3vw,32px)]',
            fill ? 'flex h-full min-h-0 flex-col py-6 max-[900px]:h-auto' : 'pt-6 pb-16',
          )}
        >
          <Outlet />
        </motion.div>
      </main>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

/* ────────────────────────────── Sidebar body ───────────────────────────── */

function SidebarBody({
  collapsed,
  onToggle,
  onSearch,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onSearch: () => void;
}) {
  const data = useData();
  const s = data.stats;
  const indicatorId = useId();

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-2.5 pt-3 pb-3">
      {/* Brand + collapse */}
      <div className={cn('flex h-9 items-center', collapsed ? 'justify-center' : 'justify-between pl-1.5')}>
        {!collapsed && (
          <Link to="/" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md [&>svg]:block">
              <AtlasMark size={28} />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Atlas</span>
          </Link>
        )}
        {onToggle &&
          (collapsed ? (
            // Collapsed: the logo stands in for the brand row and doubles as
            // the expand control — it swaps to the sidebar glyph on hover/focus.
            <Tooltip content={<span className="flex items-center gap-2">Expand <Kbd>[</Kbd></span>} side="right">
              <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                aria-expanded={false}
                className="group/logo relative grid h-8 w-8 cursor-pointer place-items-center rounded-md focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-md transition-opacity duration-150 group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0 [&>svg]:block">
                  <AtlasMark size={28} />
                </span>
                <span className="absolute inset-0 grid place-items-center rounded-md bg-surface-2 text-ink opacity-0 transition-opacity duration-150 group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100">
                  <SidebarSimple size={17} />
                </span>
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={<span className="flex items-center gap-2">Collapse <Kbd>[</Kbd></span>} side="right">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                aria-expanded
              >
                <SidebarSimple size={17} />
              </Button>
            </Tooltip>
          ))}
      </div>

      {/* Search → ⌘K */}
      <Tooltip content={collapsed ? 'Search' : null} side="right">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search"
          className={cn(
            'mt-3 flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-surface-1 text-[13px] text-ink-faint shadow-(--elevation-card) transition-colors hover:text-ink-muted focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none',
            collapsed ? 'justify-center px-0' : 'px-2.5',
          )}
        >
          <MagnifyingGlass size={15} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <span className="flex gap-0.5">
                <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </>
          )}
        </button>
      </Tooltip>

      {/* Nav */}
      <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-px">
            {collapsed ? (
              <span className="mx-auto mb-1 h-px w-5 bg-hairline" aria-hidden="true" />
            ) : (
              <p className="m-0 px-2 pb-1.5 text-[11.5px] font-medium text-ink-faint">{group.label}</p>
            )}
            {group.items.map(({ to, label, icon: Icon, count }) => (
              // The tooltip triggers on a wrapper: Radix's Slot string-merges
              // className, which would clobber NavLink's function className.
              <Tooltip key={to} content={collapsed ? label : null} side="right">
                <span className="block">
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'relative flex h-8.5 items-center gap-2.5 rounded-md text-[13.5px] no-underline transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none',
                        collapsed ? 'justify-center px-0' : 'px-2',
                        isActive ? 'text-ink' : 'text-ink-muted hover:bg-surface-1/60 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId={indicatorId}
                            transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                            className="absolute inset-0 rounded-md bg-surface-1 shadow-(--elevation-card)"
                          />
                        )}
                        <Icon
                          size={17}
                          className={cn('relative shrink-0', isActive ? 'text-accent' : 'text-ink-faint')}
                        />
                        {!collapsed && (
                          <>
                            <span className="relative truncate">{label}</span>
                            {count != null && (
                              <span className="relative ml-auto text-[11.5px] text-ink-faint tabular-nums">
                                {s[count] ?? 0}
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                </span>
              </Tooltip>
            ))}
          </div>
        ))}
      </nav>

      {/* Project card */}
      {!collapsed && (
        <div className="mt-3 rounded-lg bg-surface-1 p-3 shadow-(--elevation-card)">
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            <FolderSimple size={15} className="text-ink-faint" />
            <span className="min-w-0 truncate font-medium text-ink" title={data.meta.root}>
              {folderName(data.meta.root)}
            </span>
          </div>
          <dl className="m-0 mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11.5px] [&_dd]:m-0 [&_dd]:truncate [&_dd]:text-right [&_dd]:text-ink-muted [&_dd]:tabular-nums [&_dt]:text-ink-faint">
            <dt>Files</dt>
            <dd>{s.fileCount}</dd>
            <dt>Analyzed</dt>
            <dd title={formatTime(data.meta.generatedAt)}>{timeAgo(data.meta.generatedAt)}</dd>
            <dt>Atlas</dt>
            <dd className="font-mono">v{data.meta.toolVersion}</dd>
          </dl>
        </div>
      )}

      {/* Footer */}
      <div className={cn('mt-3 flex flex-col gap-px', collapsed && 'items-center')}>
        <FooterLink href={DOCS_URL} icon={<BookOpen size={16} />} label="Documentation" collapsed={collapsed} />
        <FooterLink href={REPO_URL} icon={<GithubLogo size={16} />} label="GitHub" collapsed={collapsed} />
      </div>
      <div className="mt-2.5 border-t border-hairline-soft pt-3">
        {collapsed ? (
          <div className="flex justify-center">
            <ThemeSwitcher variant="menu" />
          </div>
        ) : (
          <ThemeSwitcher />
        )}
      </div>
    </div>
  );
}

function FooterLink({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Tooltip content={collapsed ? label : null} side="right">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={collapsed ? label : undefined}
        className={cn(
          'flex h-8 items-center gap-2.5 rounded-md text-[13px] text-ink-muted no-underline transition-colors hover:bg-surface-1/60 hover:text-ink focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none [&_svg]:text-ink-faint',
          collapsed ? 'w-8 justify-center' : 'px-2',
        )}
      >
        {icon}
        {!collapsed && label}
      </a>
    </Tooltip>
  );
}
