import * as React from 'react';
import { cn } from '@/lib/utils';

/** shadcn Input, themed to the Atlas palette. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'w-full box-border rounded-[var(--r-md)] bg-[var(--surface-1)] text-[var(--ink)]',
          'border border-[var(--hairline-soft)] px-3.5 py-3 text-[15px] tracking-[-0.012em]',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'placeholder:text-[var(--ink-faint)]',
          'focus:outline-none focus:border-[var(--accent-ring)] focus:ring-[3px] focus:ring-[var(--accent-soft)]',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
