import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

/**
 * shadcn Dialog (Radix): focus trap, Esc/overlay dismissal and scroll lock for
 * free. `DialogContent` is centered; pass `side="left"` for a drawer.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'center' | 'left' | 'top' }
>(({ className, side = 'center', children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[oklch(0.1_0.01_var(--tint-h)/0.55)] backdrop-blur-[2px] animate-fade" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden bg-surface-1 text-ink shadow-(--elevation-pop) outline-none',
        side === 'center' &&
          'top-1/2 left-1/2 max-h-[90vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-pop',
        side === 'top' &&
          'top-[12vh] left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-xl animate-pop',
        side === 'left' && 'inset-y-0 left-0 w-[min(288px,86vw)] animate-drawer',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
