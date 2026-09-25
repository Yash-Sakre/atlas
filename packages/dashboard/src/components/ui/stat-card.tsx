import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge, type BadgeProps } from './badge';
import { InfoTip } from './info-tip';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value — the "vs last week" slot. */
  hint?: ReactNode;
  /** Corner pill. Tone is a status color, so it always carries text too. */
  badge?: { text: ReactNode; tone?: BadgeProps['variant']; icon?: ReactNode };
  info?: ReactNode;
  icon?: ReactNode;
  /** Makes the whole tile a link. */
  to?: string;
  className?: string;
}

/**
 * KPI tile: label + corner pill on top, the figure below, one hint line.
 * Sentence-case label, no trailing colon; tabular figures in the value.
 */
export function StatCard({ label, value, hint, badge, info, icon, to, className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-muted">
          {icon && <span className="text-ink-faint">{icon}</span>}
          <span className="truncate">{label}</span>
          {info && <InfoTip>{info}</InfoTip>}
        </span>
        {badge && (
          <Badge variant={badge.tone ?? 'default'}>
            {badge.icon}
            {badge.text}
          </Badge>
        )}
        {to && !badge && (
          <ArrowUpRight
            size={14}
            className="text-ink-faint transition-[color,translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
          />
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
          {value}
        </span>
        {hint && <span className="min-w-0 truncate text-[12px] text-ink-faint">{hint}</span>}
      </div>
    </>
  );

  const base = cn(
    'group flex min-w-0 flex-col rounded-xl bg-surface-1 px-5 py-4.5 shadow-(--elevation-card)',
    className,
  );

  return to ? (
    <Link
      to={to}
      className={cn(
        base,
        'no-underline transition-[background-color] duration-150 hover:bg-surface-2/70 focus-visible:ring-[3px] focus-visible:ring-accent-ring focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
