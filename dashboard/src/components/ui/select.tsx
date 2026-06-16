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
      'inline-flex items-center justify-between gap-2 rounded-full bg-[var(--surface-1)] text-[var(--ink-muted)]',
      'border border-[var(--hairline-soft)] px-4 py-[11px] text-sm tracking-[-0.012em] cursor-pointer',
      'transition-[border-color,box-shadow,color] duration-150 whitespace-nowrap',
      'focus:outline-none focus:border-[var(--accent-ring)] focus:ring-[3px] focus:ring-[var(--accent-soft)] focus:text-[var(--ink)]',
      'data-[placeholder]:text-[var(--ink-muted)] [&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <FiChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
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
        'z-50 min-w-[8rem] overflow-hidden rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--surface-2)] p-1.5',
        'shadow-[0_20px_56px_-18px_rgba(0,0,0,0.75)]',
        position === 'popper' && 'data-[side=bottom]:translate-y-1.5',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className={cn(position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}>
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
      'relative flex w-full cursor-pointer select-none items-center justify-between gap-4 rounded-[var(--r-sm)]',
      'px-2.5 py-2 text-sm text-[var(--ink-muted)] outline-none tracking-[-0.012em]',
      // Keyboard/pointer highlight must be LIGHTER than the menu (surface-2),
      // so arrow-key navigation is clearly visible.
      'data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--ink)]',
      'data-[state=checked]:text-[var(--ink)] data-[state=checked]:font-medium',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <FiCheck className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
