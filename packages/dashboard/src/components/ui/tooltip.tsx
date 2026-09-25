import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/** shadcn Tooltip (Radix). Wrap the app once in <TooltipProvider>. */
const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={200}>
    {children}
  </TooltipPrimitive.Provider>
);

function Tooltip({
  content,
  side = 'top',
  children,
}: {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactElement;
}) {
  if (content == null || content === '') return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-72 rounded-sm bg-ink px-2 py-1.25 text-[12px] leading-snug text-canvas',
            'origin-(--radix-tooltip-content-transform-origin) animate-in',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { TooltipProvider, Tooltip };
