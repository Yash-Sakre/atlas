import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Fill for this segment (a token var). */
  color: string;
}

/**
 * A proportional bar split into segments with a 2px surface gap between them
 * (the gap, not a stroke, separates neighbors). Each segment has a hover
 * tooltip; a legend or labelled tiles must accompany it so identity is never
 * color-alone.
 */
export function SegmentMeter({
  segments,
  className,
  height = 6,
}: {
  segments: Segment[];
  className?: string;
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      className={cn('flex w-full gap-0.5', className)}
      style={{ height }}
    >
      {total === 0 ? (
        <span className="h-full flex-1 rounded-full bg-surface-2" />
      ) : (
        visible.map((s, i) => (
          <Tooltip
            key={s.key}
            content={`${s.label} · ${s.value} (${Math.round((s.value / total) * 100)}%)`}
          >
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="block h-full origin-left rounded-full"
              style={{ flexGrow: s.value, flexBasis: 0, minWidth: 4, background: s.color }}
            />
          </Tooltip>
        ))
      )}
    </div>
  );
}
