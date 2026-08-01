/** Shared presentational primitives reused across views. */
import { type ReactNode } from 'react';
import { FiSearch, FiExternalLink } from 'react-icons/fi';
import type { AssetType } from './types';
import { editorHref } from './lib/editor';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Per-type badge text colors (mirrors the legend / graph palette). */
const BADGE_TEXT: Record<string, string> = {
  component: '#7fc4ff',
  hook: '#c0a8ff',
  utility: '#7be3a8',
  context: '#ffce85',
  store: '#ffb27d',
  provider: '#ff9bb0',
  route: '#e6a3ff',
};

export function TypeBadge({ type }: { type: AssetType }) {
  return (
    <Badge withDot style={{ color: BADGE_TEXT[type] || 'var(--color-ink-faint)' }}>
      {type}
    </Badge>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return <Badge variant="source">{source}</Badge>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <Badge variant="tag">{children}</Badge>;
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
    // No resolvable target — show the content inertly rather than a dead link.
    return iconOnly ? null : <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      className={cn(
        'group inline-flex max-w-full min-w-0 items-center gap-1.25 rounded-sm text-inherit no-underline transition-colors duration-120 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
        iconOnly && 'p-0.75 opacity-55 hover:opacity-100',
        className,
      )}
      title={label}
      aria-label={iconOnly ? label : undefined}
    >
      {children}
      <FiExternalLink
        className={cn(
          'h-3 w-3 shrink-0 text-accent transition-opacity duration-120',
          iconOnly
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
        aria-hidden="true"
      />
    </a>
  );
}

/** A search input with the inline magnifier glyph (react-icons). */
export function SearchField({
  value,
  onChange,
  placeholder,
  large,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <div className="relative flex-1">
      <FiSearch
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-faint',
          large ? 'left-4.5 h-4.5 w-4.5' : 'left-4 h-4 w-4',
        )}
      />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(large ? 'rounded-lg py-3.75 pr-4.5 pl-11.5 text-base' : 'pl-10.5')}
      />
    </div>
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
