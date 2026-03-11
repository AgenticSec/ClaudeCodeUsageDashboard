import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyTrendEntry } from "~/lib/types";

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function CostTokenTrendChart({ data }: { data: DailyTrendEntry[] }) {
  if (data.length === 0) {
    return (
      <ChartCard>
        <div className="flex items-center justify-center h-[350px] text-gray-400">
          データがありません
        </div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <ChartCard>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="tokens" tickFormatter={formatTokens} orientation="left" />
          <YAxis yAxisId="cost" tickFormatter={(v) => `$${v.toFixed(0)}`} orientation="right" />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "コスト") return [`$${value.toFixed(2)}`, name];
              return [formatTokens(value), name];
            }}
            contentStyle={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", color: "var(--tooltip-text)" }}
            labelStyle={{ color: "var(--tooltip-text)" }}
          />
          <Legend />
          <Area yAxisId="tokens" type="monotone" dataKey="cache_read_tokens" stackId="1" fill="#60a5fa" stroke="#60a5fa" name="Cache Read" />
          <Area yAxisId="tokens" type="monotone" dataKey="input_tokens" stackId="1" fill="#2563eb" stroke="#2563eb" name="Input" />
          <Area yAxisId="tokens" type="monotone" dataKey="output_tokens" stackId="1" fill="#1e40af" stroke="#1e40af" name="Output" />
          <Area yAxisId="tokens" type="monotone" dataKey="cache_creation_tokens" stackId="1" fill="#38bdf8" stroke="#38bdf8" name="Cache Creation" />
          <Line yAxisId="cost" type="monotone" dataKey="estimated_cost" stroke="#ef4444" strokeWidth={2} dot={false} name="コスト" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        コスト・トークン推移
      </h3>
      {children}
    </div>
  );
}
