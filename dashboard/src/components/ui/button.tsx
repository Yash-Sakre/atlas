import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * shadcn Button, themed to the Atlas palette via CSS variables so
 * it matches the existing dark/warm design rather than shadcn's defaults.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium tracking-[-0.012em] leading-none transition-[transform,background-color,border-color,color] duration-150 cursor-pointer border border-transparent active:scale-[0.97] focus-visible:outline-none focus-visible:border-[var(--accent-ring)] focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)] disabled:opacity-50 disabled:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--ink)] text-[var(--canvas)] hover:bg-[#ececec]',
        secondary:
          'bg-[var(--surface-1)] text-[var(--ink)] border-[var(--hairline-soft)] hover:bg-[var(--surface-2)]',
        ghost: 'bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-1)]',
      },
      size: {
        default: 'min-h-[42px] px-[17px] py-[11px] text-sm',
        sm: 'px-3 py-[7px] text-[13px] gap-1.5',
        icon: 'h-10 w-10 p-0 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
