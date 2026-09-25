import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Centered "nothing here" block: glyph, one line of copy, optional action. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="mb-1 grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-ink-faint">
          {icon}
        </span>
      )}
      <p className="m-0 text-[13.5px] font-medium text-ink">{title}</p>
      {children && <p className="m-0 max-w-sm text-[12.5px] text-ink-faint">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
