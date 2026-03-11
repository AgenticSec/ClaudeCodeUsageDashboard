import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { DistributionEntry } from "~/lib/types";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#a855f7", "#eab308", "#22c55e", "#f43f5e",
  "#0ea5e9", "#78716c", "#4ade80", "#fb923c", "#a78bfa",
];

const RADIAN = Math.PI / 180;

function renderInsideLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  name: string;
  percent: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const label = name.length > 8 ? name.slice(0, 7) + "…" : name;
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      <tspan x={x} dy="-0.5em">{label}</tspan>
      <tspan x={x} dy="1.2em">{`${(percent * 100).toFixed(0)}%`}</tspan>
    </text>
  );
}

interface DistributionPieChartProps {
  title: string;
  data: DistributionEntry[];
}

export function DistributionPieChart({ title, data }: DistributionPieChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard title={title}>
        <div className="flex items-center justify-center h-[300px] text-gray-400">
          データがありません
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={renderInsideLabel}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", color: "var(--tooltip-text)" }}
            labelStyle={{ color: "var(--tooltip-text)" }}
            itemStyle={{ color: "var(--tooltip-text)" }}
            formatter={(value: number, name: string) => [`${value} 件`, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
