import { EvilBarChart } from '@/components/evilcharts/charts/recharts-bar-chart';
import type { ChartConfig } from '@/components/evilcharts/ui/recharts-chart';

export interface ReuseRow extends Record<string, unknown> {
  type: string;
  reused: number;
  once: number;
  unused: number;
}

/** Ordinal: reused > once > never, so one hue stepped light → dark (validated). */
export const REUSE_SERIES = [
  { key: 'reused', label: 'Reused 2+', color: 'var(--color-chart-1)' },
  { key: 'once', label: 'Used once', color: 'var(--color-chart-2)' },
  { key: 'unused', label: 'Unused', color: 'var(--color-chart-3)' },
] as const;

const CONFIG = Object.fromEntries(
  REUSE_SERIES.map((s) => [s.key, { label: s.label, colors: { light: [s.color] } }]),
) as Record<'reused' | 'once' | 'unused', ChartConfig[string]>;

/**
 * Reuse share per asset type as 100%-stacked columns — types differ in size by
 * two orders of magnitude, so shares (not counts) are what compare. The
 * tooltip still carries the raw counts.
 */
export default function ReuseByType({ data, height = 220 }: { data: ReuseRow[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilBarChart
        data={data}
        config={CONFIG}
        stackType="percent"
        barRadius={4}
        animationType="left-to-right"
        className="aspect-auto h-full"
        chartProps={{ margin: { top: 4, right: 0, left: 0, bottom: 0 } }}
      >
        <EvilBarChart.Grid stroke="var(--color-hairline-soft)" strokeDasharray="0" />
        <EvilBarChart.XAxis
          dataKey="type"
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11.5 }}
        />
        <EvilBarChart.YAxis
          width={40}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
        />
        <EvilBarChart.Tooltip roundness="md" />
        {REUSE_SERIES.map((s) => (
          <EvilBarChart.Bar key={s.key} dataKey={s.key} barProps={{ maxBarSize: 24 }} />
        ))}
      </EvilBarChart>
    </div>
  );
}
