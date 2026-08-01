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
          'box-border w-full rounded-md bg-surface-2 text-ink',
          'px-3.5 py-3 text-[15px] tracking-[-0.012em]',
          'transition-[box-shadow,background-color] duration-150',
          'placeholder:text-ink-faint',
          'focus:ring-[3px] focus:ring-accent-soft focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
