import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** shadcn Button, on Atlas tokens. Every control on the page shares its h-8 / h-9 rhythm. */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent leading-none font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out-quint active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-canvas hover:bg-ink/88',
        accent: 'bg-accent text-accent-ink hover:bg-accent/88',
        secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
        outline: 'border-hairline bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
        ghost: 'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-9 px-3.5 text-[13.5px]',
        icon: 'h-8 w-8 p-0',
        'icon-sm': 'h-7 w-7 rounded-sm p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
