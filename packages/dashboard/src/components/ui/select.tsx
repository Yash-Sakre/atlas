import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CaretDown, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/** shadcn Select (Radix) on Atlas tokens. */
const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md bg-surface-2 px-2.75 text-[12.5px] whitespace-nowrap text-ink-muted',
      'shadow-[inset_0_0_0_1px_var(--color-hairline-soft)] transition-[box-shadow,color] duration-150 hover:text-ink',
      'focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none [&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <CaretDown size={12} weight="bold" className="shrink-0 text-ink-faint" />
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
        'z-50 min-w-32 overflow-hidden rounded-lg bg-surface-2 p-1 shadow-(--elevation-pop) animate-in',
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
      'relative flex h-8 w-full cursor-pointer items-center justify-between gap-4 rounded-sm px-2 text-[13px] text-ink-muted outline-none select-none',
      'data-highlighted:bg-surface-3 data-highlighted:text-ink data-[state=checked]:text-ink',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check size={13} weight="bold" className="text-accent" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
