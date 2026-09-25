import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * shadcn Tabs (Radix) with a shared-layout indicator (motion) that glides
 * between triggers instead of snapping. Two looks:
 *
 *   - `pill`      — segmented control (filters, view switches)
 *   - `underline` — section tabs inside a card
 *
 * Works controlled or uncontrolled; the root tracks the live value so the
 * active trigger can render the indicator.
 */
type Variant = 'pill' | 'underline';

const TabsCtx = React.createContext<{ value?: string; layoutId: string }>({ layoutId: '' });
const ListCtx = React.createContext<Variant>('pill');

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const layoutId = React.useId();
  return (
    <TabsCtx.Provider value={{ value: current, layoutId }}>
      <TabsPrimitive.Root
        ref={ref}
        value={current}
        onValueChange={(v) => {
          setInner(v);
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabsCtx.Provider>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: Variant }
>(({ className, variant = 'pill', ...props }, ref) => (
  <ListCtx.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === 'pill'
          ? 'inline-flex h-8 items-center gap-0.5 rounded-md bg-surface-2 p-0.75'
          : 'flex items-stretch gap-1 shadow-[inset_0_-1px_0_var(--color-hairline-soft)]',
        className,
      )}
      {...props}
    />
  </ListCtx.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const { value: active, layoutId } = React.useContext(TabsCtx);
  const variant = React.useContext(ListCtx);
  const isActive = active === value;
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        'group relative inline-flex cursor-pointer items-center justify-center gap-1.5 text-[12.5px] leading-none font-medium whitespace-nowrap text-ink-faint transition-colors duration-150 outline-none hover:text-ink-muted data-[state=active]:text-ink',
        'focus-visible:ring-[3px] focus-visible:ring-accent-ring',
        variant === 'pill' ? 'h-full rounded-sm px-2.75' : 'flex-1 px-2 pt-1 pb-3',
        className,
      )}
      {...props}
    >
      {isActive && (
        <motion.span
          layoutId={layoutId}
          aria-hidden="true"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
          className={cn(
            'absolute',
            variant === 'pill'
              ? 'inset-0 rounded-sm bg-surface-1 shadow-(--elevation-card)'
              : 'inset-x-0 bottom-0 h-0.5 rounded-full bg-ink',
          )}
        />
      )}
      <span className="relative z-1 inline-flex items-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = TabsPrimitive.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
