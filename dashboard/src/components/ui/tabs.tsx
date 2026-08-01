import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

/**
 * shadcn Tabs (Radix) used as the segmented control throughout the dashboard,
 * themed to the Atlas palette.
 */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex items-center gap-0.5 rounded-full bg-surface-1 p-0.75', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.25 py-1.75',
      'text-[13px] leading-none font-medium tracking-[-0.012em] text-ink-muted',
      'transition-[background-color,color] duration-150 hover:text-ink',
      'focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none',
      'data-[state=active]:bg-surface-3 data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.3)]',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export { Tabs, TabsList, TabsTrigger };
