import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSearchParams } from "react-router";
import type { UserRankingEntry } from "~/lib/types";
import { CHART_HEIGHT } from "~/lib/constants";

const Y_AXIS_LABEL_WIDTH = 100;
const Y_AXIS_LABEL_MAX_LENGTH = 12;
const Y_AXIS_LABEL_FONT_SIZE = 12;
const CHART_MARGIN = { left: 20, right: 20, top: 5, bottom: 5 };

export function UserRankingChart({ data }: { data: UserRankingEntry[] }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const chartData = data.map((entry) => ({
    ...entry,
    // Show email prefix for readability
    name: entry.email.split("@")[0],
  }));

  if (chartData.length === 0) {
    return <EmptyState />;
  }

  const handleBarClick = (entry: UserRankingEntry & { name: string }) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("user_id", String(entry.user_id));
    setSearchParams(newParams);
  };

  return (
    <ChartCard title="User Ranking (by Cost)">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={chartData} layout="vertical" margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}`} />
          <YAxis
            type="category"
            dataKey="name"
            width={Y_AXIS_LABEL_WIDTH}
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              const label = payload.value.length > Y_AXIS_LABEL_MAX_LENGTH ? `${payload.value.slice(0, Y_AXIS_LABEL_MAX_LENGTH)}...` : payload.value;
              return (
                <text x={x - (Y_AXIS_LABEL_WIDTH - 5)} y={y} dy={4} fontSize={Y_AXIS_LABEL_FONT_SIZE} textAnchor="start" fill="currentColor">
                  {label}
                </text>
              );
            }}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
            contentStyle={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", color: "var(--tooltip-text)" }}
            labelStyle={{ color: "var(--tooltip-text)" }}
          />
          <Bar
            dataKey="total_cost"
            fill="#3b82f6"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={handleBarClick}
          />
        </BarChart>
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

function EmptyState() {
  return (
    <ChartCard title="User Ranking (by Cost)">
      <div className="flex items-center justify-center text-gray-400" style={{ height: CHART_HEIGHT }}>
        No data available
      </div>
    </ChartCard>
  );
}
