import { useSearchParams } from "react-router";
import type { RecentSessionEntry } from "~/lib/types";
import { formatTokens } from "~/lib/format";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

function formatDuration(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;
  return `${hours}h${remainingMinutes}m`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentSessionsTable({
  sessions,
}: {
  sessions: RecentSessionEntry[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const setFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    setSearchParams(newParams);
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Recent Sessions
        </h3>
        <div className="text-center text-gray-400 py-8">No data available</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Recent Sessions
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">User</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Repo</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Model</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Duration</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Turns</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Skill</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">MCP</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">SubAg</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Token</th>
              <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const totalTokens =
                s.input_tokens +
                s.output_tokens +
                s.cache_read_tokens +
                s.cache_creation_tokens;
              return (
                <tr
                  key={s.session_id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-2 px-2">
                    <button
                      onClick={() => setFilter("user_id", String(s.user_id))}
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {s.email.split("@")[0]}
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => setFilter("repo", s.repo_name)}
                      className="text-green-600 dark:text-green-400 hover:underline cursor-pointer text-xs"
                    >
                      {s.repo_name}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-xs">
                      {s.model.replace("claude-", "")}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                    {formatDate(s.last_event_at)}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">
                    {formatDuration(s.duration_seconds)}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                    {s.conversation_turns}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                    {s.skill_call_count}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                    {s.mcp_call_count}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                    {s.subagent_call_count}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">
                    {formatTokens(totalTokens)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
                    ${s.estimated_cost_usd.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
