import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn Badge on Atlas tokens. Tones are status colors — always paired with text. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.25 whitespace-nowrap rounded-full text-[11px] leading-none font-medium tabular-nums',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 px-2 py-1 text-ink-muted',
        outline: 'px-2 py-1 text-ink-muted shadow-[inset_0_0_0_1px_var(--color-hairline)]',
        source: 'bg-surface-2 px-2 py-1 lowercase text-ink-faint',
        tag: 'rounded-xs bg-surface-2 px-1.5 py-0.75 font-mono text-[11px] font-normal text-ink-muted',
        success: 'bg-success-soft px-2 py-1 text-success',
        warn: 'bg-warn-soft px-2 py-1 text-warn',
        danger: 'bg-danger-soft px-2 py-1 text-danger',
        accent: 'bg-accent-soft px-2 py-1 text-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading dot. `true` paints it `currentColor`; a string paints that color. */
  dot?: boolean | string;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          style={typeof dot === 'string' ? { background: dot } : undefined}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
