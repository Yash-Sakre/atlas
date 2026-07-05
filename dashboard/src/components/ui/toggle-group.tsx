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
      'inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] cursor-pointer',
      'text-[12.5px] font-medium leading-none tracking-[-0.01em]',
      'transition-[background-color,color,opacity] duration-150',
      // "on" (data-state=on): lit chip
      'data-[state=on]:bg-[var(--surface-3)] data-[state=on]:text-[var(--ink)]',
      // "off" (data-state=off): dimmed, subtle fill keeps the chip shape
      'data-[state=off]:bg-[var(--surface-1)] data-[state=off]:text-[var(--ink-faint)] data-[state=off]:opacity-80 data-[state=off]:hover:opacity-100 data-[state=off]:hover:text-[var(--ink-muted)]',
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)]',
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
