import * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Minimal shadcn-style chart primitives, themed to the Atlas palette.
 * `ChartContainer` is a responsive wrapper; `ChartTooltip` is a borderless
 * hover card matching the rest of the dark UI. Kept lean (rather than the full
 * shadcn boilerplate) for recharts 3 compatibility and to reuse across views.
 */
export function ChartContainer({
  height = 220,
  minHeight = 180,
  fill,
  className,
  children,
}: {
  height?: number;
  /** Floor height when `fill` lets the chart grow to its container. */
  minHeight?: number;
  /** Grow to fill a flex parent (e.g. a stretched bento card) instead of a fixed height. */
  fill?: boolean;
  className?: string;
  children: React.ReactElement;
}) {
  const style: React.CSSProperties = fill
    ? { flex: '1 1 auto', minHeight, width: '100%' }
    : { height, width: '100%' };
  return (
    <div
      className={cn(
        "font-body [&_svg]:overflow-visible [&_text]:font-features-['tnum']",
        className,
      )}
      style={style}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export interface TooltipDatum {
  label: string;
  value: number;
  hue?: string;
  sub?: string;
}

/** Recharts `content` render-prop — expects each datum to carry {label,value,hue,sub}. */
export function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipDatum; value: number }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-surface-2 px-2.75 py-1.75 text-[12.5px] whitespace-nowrap shadow-card">
      {d.hue && (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.hue }} />
      )}
      <span className="text-ink-muted">{d.label}</span>
      <span className="font-semibold tabular-nums text-ink">{d.value}</span>
      {d.sub && <span className="text-[11.5px] text-ink-faint">{d.sub}</span>}
    </div>
  );
}
