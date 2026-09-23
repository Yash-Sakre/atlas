import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * shadcn Button, themed to the Atlas palette via CSS variables so
 * it matches the existing dark/warm design rather than shadcn's defaults.
 */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent leading-none font-medium tracking-[-0.012em] whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] focus-visible:border-accent-ring focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-canvas hover:bg-[#ececec]',
        secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
        ghost: 'bg-transparent text-ink-muted hover:bg-surface-1 hover:text-ink',
      },
      size: {
        default: 'min-h-10.5 px-4.25 py-2.75 text-sm',
        sm: 'gap-1.5 px-3 py-1.75 text-[13px]',
        icon: 'h-10 w-10 rounded-full p-0',
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
