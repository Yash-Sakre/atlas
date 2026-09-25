import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Title row shared by every view: title + one-line description, actions right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        <h1 className="m-0 text-[20px] leading-tight font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 mb-0 max-w-2xl text-[13px] text-pretty text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
