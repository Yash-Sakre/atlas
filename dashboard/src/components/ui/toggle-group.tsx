import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

/**
 * shadcn ToggleGroup (Radix), themed to the Atlas palette and used
 * for the filter chips (node types, edge kinds, tags). The "on" state is the
 * lit chip; "off" is dimmed — matching the dashboard's filter affordance.
 */
const ToggleGroup = ToggleGroupPrimitive.Root;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.75 py-1.25',
      'text-[12.5px] leading-none font-medium tracking-[-0.01em]',
      'transition-[background-color,color,opacity] duration-150',
      // "on" (data-state=on): lit chip
      'data-[state=on]:bg-surface-3 data-[state=on]:text-ink',
      // "off" (data-state=off): dimmed, subtle fill keeps the chip shape
      'data-[state=off]:bg-surface-1 data-[state=off]:text-ink-faint data-[state=off]:opacity-80 data-[state=off]:hover:text-ink-muted data-[state=off]:hover:opacity-100',
      'focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none',
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
