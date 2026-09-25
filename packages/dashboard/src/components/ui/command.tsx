import * as React from 'react';
import { Command as Cmdk } from 'cmdk';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog';

/** shadcn Command (cmdk) on Atlas tokens, plus a dialog shell for ⌘K. */
const Command = React.forwardRef<
  React.ElementRef<typeof Cmdk>,
  React.ComponentPropsWithoutRef<typeof Cmdk>
>(({ className, ...props }, ref) => (
  <Cmdk ref={ref} className={cn('flex h-full w-full flex-col text-ink', className)} {...props} />
));
Command.displayName = 'Command';

function CommandDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="top" aria-describedby="cmdk-desc">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <DialogDescription id="cmdk-desc" className="sr-only">
          Search pages, assets and actions
        </DialogDescription>
        <Command loop>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof Cmdk.Input>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2.5 px-4 shadow-[inset_0_-1px_0_var(--color-hairline-soft)]">
    <MagnifyingGlass size={16} className="shrink-0 text-ink-faint" />
    <Cmdk.Input
      ref={ref}
      className={cn(
        'h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint',
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<
  React.ElementRef<typeof Cmdk.List>,
  React.ComponentPropsWithoutRef<typeof Cmdk.List>
>(({ className, ...props }, ref) => (
  <Cmdk.List
    ref={ref}
    className={cn(
      'max-h-[min(420px,60vh)] scroll-py-2 overflow-y-auto overscroll-contain p-1.5 transition-[height] duration-150',
      className,
    )}
    {...props}
  />
));
CommandList.displayName = 'CommandList';

function CommandEmpty(props: React.ComponentPropsWithoutRef<typeof Cmdk.Empty>) {
  return <Cmdk.Empty className="py-10 text-center text-[13px] text-ink-faint" {...props} />;
}

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof Cmdk.Group>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Group>
>(({ className, ...props }, ref) => (
  <Cmdk.Group
    ref={ref}
    className={cn(
      '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint',
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = 'CommandGroup';

const CommandItem = React.forwardRef<
  React.ElementRef<typeof Cmdk.Item>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Item>
>(({ className, ...props }, ref) => (
  <Cmdk.Item
    ref={ref}
    className={cn(
      'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink-muted select-none',
      'data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = 'CommandItem';

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
