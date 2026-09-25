import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The one container on the page. Borderless: a surface step plus a hairline
 * ring (`--elevation-card`) separates it from the canvas in both modes.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Revenue</CardTitle>
 *       <CardAction>…</CardAction>
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *   </Card>
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col rounded-xl bg-surface-1 shadow-(--elevation-card)',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex min-h-8 items-center justify-between gap-3 px-5 pt-4.5', className)}
      {...props}
    />
  );
}

function CardTitle({
  className,
  info,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { info?: React.ReactNode }) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        'm-0 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-muted',
        className,
      )}
      {...props}
    >
      {children}
      {info}
    </h2>
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('m-0 text-[12.5px] text-ink-faint', className)} {...props} />;
}

function CardAction({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('min-w-0 px-5 pt-3 pb-5', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent };
