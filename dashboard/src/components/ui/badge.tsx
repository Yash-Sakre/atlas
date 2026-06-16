import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn Badge, themed to the Atlas palette. */
const badgeVariants = cva(
  'inline-flex items-center gap-[5px] whitespace-nowrap font-semibold tracking-[-0.01em]',
  {
    variants: {
      variant: {
        default:
          'rounded-full px-[9px] py-[3px] text-[11px] border border-[var(--hairline-soft)] bg-[var(--surface-2)] text-[var(--ink-muted)]',
        source:
          'rounded-full px-[9px] py-[3px] text-[11px] border border-[var(--hairline-soft)] bg-[var(--surface-1)] text-[var(--ink-faint)] lowercase',
        tag: 'rounded-[var(--r-sm)] px-[7px] py-[2px] text-[11px] font-normal font-mono border border-[var(--hairline-soft)] bg-[var(--surface-2)] text-[var(--ink-muted)]',
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
