import * as React from 'react';
import { cn } from '@/lib/utils';

/** shadcn Input on Atlas tokens — h-9 to line up with buttons and selects. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'box-border h-9 w-full rounded-md bg-surface-2 px-3 text-[13.5px] text-ink',
        'shadow-[inset_0_0_0_1px_var(--color-hairline-soft)] transition-[box-shadow,background-color] duration-150',
        'placeholder:text-ink-faint hover:bg-surface-3/60',
        'focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent-ring)] focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none',
        '[&::-webkit-search-cancel-button]:appearance-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
