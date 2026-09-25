import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

/**
 * shadcn ToggleGroup (Radix) as filter chips. "On" is a lit chip with a
 * hairline; "off" recedes. Always text-labelled, so state never rests on color.
 */
const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex flex-wrap items-center gap-1.5', className)}
    {...props}
  />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.75 text-[12px] leading-none font-medium',
      'transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97]',
      'data-[state=on]:bg-accent-soft data-[state=on]:text-ink data-[state=on]:shadow-[inset_0_0_0_1px_var(--color-accent-ring)]',
      'data-[state=off]:text-ink-faint data-[state=off]:shadow-[inset_0_0_0_1px_var(--color-hairline-soft)] data-[state=off]:hover:bg-surface-2 data-[state=off]:hover:text-ink-muted',
      'focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none',
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
