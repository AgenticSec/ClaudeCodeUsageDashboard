import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyToolUsageEntry } from "~/lib/types";

export function DailyToolUsageChart({ data }: { data: DailyToolUsageEntry[] }) {
  if (data.length === 0) {
    return (
      <ChartCard>
        <div className="flex items-center justify-center h-[300px] text-gray-400">
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
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", color: "var(--tooltip-text)" }}
            labelStyle={{ color: "var(--tooltip-text)" }}
          />
          <Legend />
          <Area type="monotone" dataKey="mcp_count" stackId="1" fill="#3b82f6" stroke="#3b82f6" name="MCP" />
          <Area type="monotone" dataKey="subagent_count" stackId="1" fill="#10b981" stroke="#10b981" name="SubAgent" />
          <Area type="monotone" dataKey="skill_count" stackId="1" fill="#f59e0b" stroke="#f59e0b" name="Skill" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        日別ツール利用推移
      </h3>
      {children}
    </div>
  );
}
