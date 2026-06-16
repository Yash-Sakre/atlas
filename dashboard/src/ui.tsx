/** Shared presentational primitives reused across views. */
import { useMemo, type ReactNode } from 'react';
import Fuse from 'fuse.js';
import { FiSearch } from 'react-icons/fi';
import type { AssetType } from './types';
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
    <Badge withDot style={{ color: BADGE_TEXT[type] || 'var(--ink-faint)' }}>
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
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--ink-faint)]',
          large ? 'left-[18px] h-[18px] w-[18px]' : 'left-4 h-4 w-4',
        )}
      />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(large ? 'pl-[46px] pr-[18px] py-[15px] text-base rounded-[var(--r-lg)]' : 'pl-[42px]')}
      />
    </div>
  );
}

/** Build a memoized Fuse index + a filter helper for a list of items. */
export function useFuzzy<T>(items: T[], keys: string[]) {
  const fuse = useMemo(
    () => new Fuse(items, { keys, threshold: 0.38, ignoreLocation: true, minMatchCharLength: 2 }),
    [items, keys.join(',')],
  );
  return (q: string): T[] => {
    const query = q.trim();
    if (!query) return items.slice();
    return fuse.search(query).map((r) => r.item);
  };
}
