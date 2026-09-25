import { useNavigate } from 'react-router-dom';
import { BookOpen, Desktop, GithubLogo, Moon, Sun } from '@phosphor-icons/react';
import { useData } from '@/data';
import { NAV, DOCS_URL, REPO_URL } from '@/nav';
import { useTheme } from '@/theme';
import { PAGE_FOR, TYPE_HUE } from '@/ui';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';

/**
 * ⌘K palette: jump to a page, to any analyzed asset (deep-linked with
 * `?focus=<id>` so its browser opens with it selected), or flip the theme.
 */
export default function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const data = useData();
  const navigate = useNavigate();
  const { setMode } = useTheme();

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const records = data.search || [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, components, hooks…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          {NAV.map(({ to, label, icon: Icon, count, keywords }) => (
            <CommandItem
              key={to}
              value={`page ${label}`}
              keywords={keywords}
              onSelect={() => run(() => navigate(to))}
            >
              <Icon size={16} className="text-ink-faint" />
              {label}
              {count && (
                <span className="ml-auto text-[12px] text-ink-faint tabular-nums">
                  {data.stats[count] ?? 0}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {records.length > 0 && (
          <CommandGroup heading="Assets">
            {records.map((r) => (
              <CommandItem
                key={r.id}
                value={r.id}
                keywords={[r.name, r.type]}
                onSelect={() =>
                  run(() =>
                    navigate(`${PAGE_FOR[r.type] || '/'}?focus=${encodeURIComponent(r.id)}`),
                  )
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: TYPE_HUE[r.type] }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[12.5px] text-ink">{r.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-faint">
                  {r.path}
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">{r.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Appearance">
          <CommandItem value="theme light mode" onSelect={() => run(() => setMode('light'))}>
            <Sun size={16} className="text-ink-faint" /> Light mode
          </CommandItem>
          <CommandItem value="theme dark mode" onSelect={() => run(() => setMode('dark'))}>
            <Moon size={16} className="text-ink-faint" /> Dark mode
          </CommandItem>
          <CommandItem value="theme system mode" onSelect={() => run(() => setMode('system'))}>
            <Desktop size={16} className="text-ink-faint" /> Match system
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Help">
          <CommandItem value="documentation docs" onSelect={() => run(() => window.open(DOCS_URL, '_blank'))}>
            <BookOpen size={16} className="text-ink-faint" /> Documentation
          </CommandItem>
          <CommandItem value="github repository source" onSelect={() => run(() => window.open(REPO_URL, '_blank'))}>
            <GithubLogo size={16} className="text-ink-faint" /> GitHub repository
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-4 px-4 py-2.5 text-[11.5px] text-ink-faint shadow-[inset_0_1px_0_var(--color-hairline-soft)]">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Kbd>esc</Kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}
