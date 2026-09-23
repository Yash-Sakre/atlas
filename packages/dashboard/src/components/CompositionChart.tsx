import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from './ui/chart';

export interface CompositionDatum {
  key: string;
  label: string;
  value: number;
  hue: string;
}

/**
 * Codebase makeup as a vertical bar chart — magnitude comparison across asset
 * types. Bars are sorted descending (rank order also separates the CVD-adjacent
 * blue/purple hues) and carry both an x-axis label and a value label, so
 * identity never rests on color alone.
 */
export default function CompositionChart({ data }: { data: CompositionDatum[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const rows = [...data]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((d) => ({ ...d, sub: total ? `${Math.round((d.value / total) * 100)}% of total` : undefined }));

  return (
    <ChartContainer fill minHeight={120}>
      <BarChart data={rows} margin={{ top: 18, right: 6, left: 6, bottom: 0 }} barCategoryGap="26%">
        <CartesianGrid vertical={false} stroke="var(--color-hairline-soft)" strokeDasharray="0" />
        <XAxis
          dataKey="label"
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11.5 }}
          dy={6}
        />
        <YAxis hide domain={[0, 'dataMax']} />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5, radius: 6 }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={68}>
          {rows.map((d) => (
            <Cell key={d.key} fill={d.hue} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            offset={9}
            fill="var(--color-ink)"
            fontSize={12.5}
            fontWeight={600}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
