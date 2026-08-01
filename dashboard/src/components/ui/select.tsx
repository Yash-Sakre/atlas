import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { cn } from '@/lib/utils';

/** shadcn Select (Radix), themed to the Atlas palette. */
const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-between gap-2 rounded-full bg-surface-2 text-ink-muted',
      'cursor-pointer px-4 py-2.75 text-sm tracking-[-0.012em]',
      'whitespace-nowrap transition-[box-shadow,color] duration-150',
      'focus:text-ink focus:ring-[3px] focus:ring-accent-soft focus:outline-none',
      'data-[placeholder]:text-ink-muted [&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <FiChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'z-50 min-w-32 overflow-hidden rounded-md bg-surface-2 p-1.5',
        'shadow-[0_20px_56px_-18px_rgba(0,0,0,0.75)]',
        position === 'popper' && 'data-[side=bottom]:translate-y-1.5',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(position === 'popper' && 'w-full min-w-(--radix-select-trigger-width)')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer items-center justify-between gap-4 rounded-sm select-none',
      'px-2.5 py-2 text-sm tracking-[-0.012em] text-ink-muted outline-none',
      // Keyboard/pointer highlight must be LIGHTER than the menu (surface-2),
      // so arrow-key navigation is clearly visible.
      'data-highlighted:bg-accent-soft data-highlighted:text-ink',
      'data-[state=checked]:font-medium data-[state=checked]:text-ink',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <FiCheck className="h-3.5 w-3.5 text-accent" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
