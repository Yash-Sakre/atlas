import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn Badge, themed to the Atlas palette. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.25 whitespace-nowrap font-semibold tracking-[-0.01em]',
  {
    variants: {
      variant: {
        default: 'rounded-full bg-surface-2 px-2.25 py-0.75 text-[11px] text-ink-muted',
        source: 'rounded-full bg-surface-2 px-2.25 py-0.75 text-[11px] lowercase text-ink-faint',
        tag: 'rounded-sm bg-surface-2 px-1.75 py-0.5 font-mono text-[11px] font-normal tracking-normal text-ink-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a leading dot in `currentColor` (used by type badges). */
  withDot?: boolean;
}

function Badge({ className, variant, withDot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
