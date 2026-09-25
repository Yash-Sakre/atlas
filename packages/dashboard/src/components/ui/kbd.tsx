import { cn } from '@/lib/utils';

/** A keycap, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-xs bg-surface-3 px-1 font-body text-[10.5px] leading-none font-medium text-ink-muted shadow-[inset_0_-1px_0_var(--color-hairline)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
