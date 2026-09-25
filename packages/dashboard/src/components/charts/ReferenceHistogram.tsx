import { EvilBarChart } from '@/components/evilcharts/charts/recharts-bar-chart';
import type { ChartConfig } from '@/components/evilcharts/ui/recharts-chart';

export interface RefBucket extends Record<string, unknown> {
  /** Axis label, e.g. "3–5×". */
  bucket: string;
  assets: number;
}

/** Reference-count buckets: [label, min, max]. Widen toward the tail so the
 *  long flat run of 1–2× assets and the rare heavy hitters both stay legible. */
const BUCKETS: Array<[string, number, number]> = [
  ['Unused', 0, 0],
  ['1×', 1, 1],
  ['2×', 2, 2],
  ['3–5×', 3, 5],
  ['6–10×', 6, 10],
  ['11–20×', 11, 20],
  ['21+', 21, Infinity],
];

/** Count assets per reference bucket. Every bucket is kept (even at 0) so the
 *  axis reads the same whichever asset type is filtered. */
export function bucketize(usageCounts: number[]): RefBucket[] {
  return BUCKETS.map(([bucket, min, max]) => ({
    bucket,
    assets: usageCounts.filter((n) => n >= min && n <= max).length,
  }));
}

const CONFIG = {
  assets: { label: 'Assets', colors: { light: ['var(--color-chart-1)'] } },
} satisfies ChartConfig;

/**
 * How widely assets are reused: a histogram of assets by reference count.
 * Seven bars no matter how large the codebase, one series (the card title
 * names it, so no legend), value on each cap, hover tooltip with the count.
 */
export default function ReferenceHistogram({ data, height = 240 }: { data: RefBucket[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilBarChart
        data={data}
        config={CONFIG}
        barRadius={4}
        animationType="left-to-right"
        className="aspect-auto h-full"
        chartProps={{ margin: { top: 20, right: 0, left: 0, bottom: 0 } }}
      >
        <EvilBarChart.Grid stroke="var(--color-hairline-soft)" strokeDasharray="0" vertical={false} />
        <EvilBarChart.XAxis dataKey="bucket" tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }} />
        <EvilBarChart.YAxis
          width={36}
          allowDecimals={false}
          tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
        />
        <EvilBarChart.Tooltip roundness="md" />
        <EvilBarChart.Bar
          dataKey="assets"
          barProps={{
            maxBarSize: 44,
            label: { position: 'top', offset: 8, fill: 'var(--color-ink)', fontSize: 12, fontWeight: 500 },
          }}
        />
      </EvilBarChart>
    </div>
  );
}
