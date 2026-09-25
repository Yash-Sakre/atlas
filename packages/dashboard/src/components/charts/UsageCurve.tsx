import { EvilAreaChart } from '@/components/evilcharts/charts/recharts-area-chart';
import type { ChartConfig } from '@/components/evilcharts/ui/recharts-chart';

export interface UsagePoint extends Record<string, unknown> {
  /** Asset name — the x category, and the tooltip's heading. */
  name: string;
  refs: number;
}

const CONFIG = {
  refs: { label: 'References', colors: { light: ['var(--color-chart-1)'] } },
} satisfies ChartConfig;

/**
 * The reference curve: every referenced asset ranked by how many places use
 * it, most → least. One series (so no legend — the card title names it), a
 * 2px line over a faint wash, crosshair tooltip naming the asset under it.
 */
export default function UsageCurve({ data, height = 260 }: { data: UsagePoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilAreaChart
        data={data}
        config={CONFIG}
        curveType="monotone"
        animationType="left-to-right"
        className="aspect-auto h-full"
        chartProps={{ margin: { top: 8, right: 4, left: 0, bottom: 0 } }}
      >
        <EvilAreaChart.Grid stroke="var(--color-hairline-soft)" strokeDasharray="0" />
        <EvilAreaChart.XAxis dataKey="name" tick={false} height={4} />
        <EvilAreaChart.YAxis
          width={36}
          allowDecimals={false}
          tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
        />
        <EvilAreaChart.Tooltip roundness="md" />
        <EvilAreaChart.Area dataKey="refs" variant="gradient" strokeVariant="solid" strokeWidth={2}>
          <EvilAreaChart.ActiveDot variant="default" />
        </EvilAreaChart.Area>
      </EvilAreaChart>
    </div>
  );
}
