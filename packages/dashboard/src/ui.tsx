/** Shared presentational primitives + helpers reused across views. */
import { forwardRef, type ReactNode } from 'react';
import { ArrowSquareOut, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { AssetType } from './types';
import { editorHref } from './lib/editor';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Identity hue per asset type (a token var). Dots only — text stays in ink. */
export const TYPE_HUE: Record<string, string> = {
  component: 'var(--color-t-component)',
  hook: 'var(--color-t-hook)',
  utility: 'var(--color-t-utility)',
  context: 'var(--color-t-context)',
  store: 'var(--color-t-store)',
  provider: 'var(--color-t-provider)',
  route: 'var(--color-t-route)',
  file: 'var(--color-ink-faint)',
  external: 'var(--color-ink-faint)',
};

/** Which browser page lists a given asset type. */
export const PAGE_FOR: Record<string, string> = {
  component: '/components',
  hook: '/hooks',
  utility: '/utils',
  context: '/contexts',
  store: '/contexts',
  provider: '/contexts',
  route: '/routes',
};

/** Table chrome: hairline rules, sticky header on the card surface. */
export const TABLE_CLASS =
  'w-full border-collapse text-[13px] [&_td]:border-b [&_td]:border-hairline-soft [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-middle [&_td]:text-ink-muted [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:h-9 [&_th]:border-b [&_th]:border-hairline-soft [&_th]:bg-surface-1 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-ink-faint [&_th:first-child]:pl-5 [&_th:last-child]:pr-5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-2/50 [&_tr:last-child_td]:border-b-0';

export function TypeBadge({ type }: { type: AssetType }) {
  return <Badge dot={TYPE_HUE[type] || 'var(--color-ink-faint)'}>{type}</Badge>;
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return <Badge variant="source">{source}</Badge>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <Badge variant="tag">{children}</Badge>;
}

/** Last path segment, e.g. "/home/yash/Repo/chat-pdf" → "chat-pdf". */
export function folderName(p: string): string {
  if (!p) return p;
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** ISO timestamp → "Sep 24, 2026, 3:26 PM". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** ISO timestamp → "3 hours ago" (falls back to the date past a week). */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const s = Math.round((Date.now() - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 604800) return rtf.format(-Math.round(s / 86400), 'day');
  return formatTime(iso);
}

/** 1284 → "1,284"; 12900 → "12.9K". */
export function compact(n: number): string {
  return n >= 10000
    ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : n.toLocaleString();
}

/**
 * A link that opens a source file in the user's editor (VS Code by default).
 * Renders plain, non-interactive content when no location can be resolved, so
 * it's always safe to drop into a table cell or row.
 */
export function EditorLink({
  root,
  path,
  line,
  column,
  children,
  className,
  iconOnly,
}: {
  root?: string;
  path?: string;
  line?: number;
  column?: number;
  children?: ReactNode;
  className?: string;
  /** Render only the icon (for dense rows/tables). */
  iconOnly?: boolean;
}) {
  const href = editorHref(root, path, line, column);
  const label = `Open ${path ?? 'file'}${line ? `:${line}` : ''} in editor`;

  if (!href) {
    return iconOnly ? null : <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      className={cn(
        'group/el inline-flex max-w-full min-w-0 items-center gap-1.25 rounded-xs text-inherit no-underline transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none',
        iconOnly && 'p-0.75 text-ink-faint',
        className,
      )}
      title={label}
      aria-label={iconOnly ? label : undefined}
    >
      {children}
      <ArrowSquareOut
        size={12}
        className={cn(
          'shrink-0 transition-opacity duration-150',
          iconOnly
            ? 'opacity-100'
            : 'opacity-0 group-hover/el:opacity-100 group-focus-visible/el:opacity-100',
        )}
        aria-hidden="true"
      />
    </a>
  );
}

/** A search input with a leading glyph and a clear button once it has text. */
export const SearchField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    /** Accessible name when there's no visible label. */
    label?: string;
  }
>(({ value, onChange, placeholder, className, label }, ref) => (
  <div className={cn('relative min-w-0 flex-1', className)}>
    <MagnifyingGlass
      size={15}
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
    />
    <Input
      ref={ref}
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.stopPropagation();
          onChange('');
        }
      }}
      className="pr-8 pl-9"
    />
    {value && (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange('')}
        className="absolute top-1/2 right-2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-faint hover:bg-surface-3 hover:text-ink"
      >
        <X size={11} weight="bold" />
      </button>
    )}
  </div>
));
SearchField.displayName = 'SearchField';

/** "12 / 80" filter result count. */
export function FilterCount({ shown, total }: { shown: number; total: number }) {
  return (
    <span className="shrink-0 text-[12px] whitespace-nowrap text-ink-faint tabular-nums">
      <b className="font-medium text-ink-muted">{shown}</b> / {total}
    </span>
  );
}

/**
 * Plain case-insensitive substring filter over the given fields.
 *
 * An empty query returns everything, so callers can chain their own
 * filters (type, usage, tag…) on top of the result.
 */
export function useSearch<T>(items: T[], keys: string[]) {
  return (q: string): T[] => {
    const query = q.trim().toLowerCase();
    if (!query) return items.slice();
    return items.filter((item) =>
      keys.some((key) => {
        const value = (item as Record<string, unknown>)[key];
        return value != null && String(value).toLowerCase().includes(query);
      }),
    );
  };
}
