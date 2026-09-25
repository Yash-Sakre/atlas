import * as React from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

/** shadcn DropdownMenu (Radix) on Atlas tokens. */
const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;
const DropdownMenuGroup = Menu.Group;
const DropdownMenuRadioGroup = Menu.RadioGroup;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Menu.Content>,
  React.ComponentPropsWithoutRef<typeof Menu.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <Menu.Portal>
    <Menu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-48 overflow-hidden rounded-lg bg-surface-2 p-1 text-ink shadow-(--elevation-pop)',
        'animate-in',
        className,
      )}
      {...props}
    />
  </Menu.Portal>
));
DropdownMenuContent.displayName = Menu.Content.displayName;

const ITEM =
  'relative flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-[13px] text-ink-muted outline-none select-none data-highlighted:bg-surface-3 data-highlighted:text-ink data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0';

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Menu.Item>,
  React.ComponentPropsWithoutRef<typeof Menu.Item>
>(({ className, ...props }, ref) => <Menu.Item ref={ref} className={cn(ITEM, className)} {...props} />);
DropdownMenuItem.displayName = Menu.Item.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof Menu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof Menu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <Menu.RadioItem ref={ref} className={cn(ITEM, 'pr-7', className)} {...props}>
    {children}
    <Menu.ItemIndicator className="absolute right-2 h-1.5 w-1.5 rounded-full bg-accent" />
  </Menu.RadioItem>
));
DropdownMenuRadioItem.displayName = Menu.RadioItem.displayName;

function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('px-2 pt-1.5 pb-1 text-[11px] font-medium text-ink-faint', className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-hairline-soft', className)} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
