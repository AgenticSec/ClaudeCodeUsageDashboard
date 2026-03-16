import type { Route } from "./+types/home";
import type { DashboardData } from "~/lib/types";
import { getDashboardData } from "~/lib/db.server";
import { KpiCards } from "~/components/KpiCards";
import { PeriodSelector } from "~/components/PeriodSelector";
import { UserRankingChart } from "~/components/UserRankingChart";
import { DistributionPieChart } from "~/components/DistributionPieChart";
import { CostTokenTrendChart } from "~/components/CostTokenTrendChart";
import { DailyToolUsageChart } from "~/components/DailyToolUsageChart";
import { RecentSessionsTable } from "~/components/RecentSessionsTable";

export function meta() {
  return [
    { title: "Claude Code Usage Dashboard" },
    { name: "description", content: "Visualize Claude Code usage across your team" },
  ];
}

import { PERIOD_OPTIONS, DEFAULT_DAYS } from "~/lib/constants";

const VALID_DAYS: readonly number[] = PERIOD_OPTIONS.map((p) => p.days);

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : DEFAULT_DAYS;
  const validDays = VALID_DAYS.includes(days) ? days : DEFAULT_DAYS;

  const db = context.cloudflare.env.DB;
  const data = await getDashboardData(db, validDays);

  return data;
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const data = loaderData as DashboardData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Claude Code Usage Dashboard
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Period Selector */}
        <PeriodSelector currentDays={data.days} />

        {/* KPI Cards */}
        <KpiCards kpi={data.kpi} />

        {/* Row 1: User Ranking + Skill Distribution + MCP Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <UserRankingChart data={data.userRanking} />
          <DistributionPieChart
            title="Skill Distribution"
            data={data.skillDistribution}
          />
          <DistributionPieChart
            title="MCP Server Distribution"
            data={data.mcpDistribution}
          />
        </div>

        {/* Row 2: Cost/Token Trend (full width) */}
        <CostTokenTrendChart data={data.dailyTrend} />

        {/* Row 3: Model Distribution + Subagent Distribution + Daily Tool Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DistributionPieChart
            title="Model Distribution"
            data={data.modelDistribution}
          />
          <DistributionPieChart
            title="Sub-agent Distribution"
            data={data.subagentDistribution}
          />
          <DailyToolUsageChart data={data.dailyToolUsage} />
        </div>

        {/* Row 4: Recent Sessions Table */}
        <RecentSessionsTable sessions={data.recentSessions} />
      </main>
    </div>
  );
}
