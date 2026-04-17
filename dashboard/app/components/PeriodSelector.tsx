import { useSearchParams } from "react-router";
import { PERIOD_OPTIONS } from "~/lib/constants";

export function PeriodSelector({ currentDays }: { currentDays: number }) {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div className="flex gap-2">
      {PERIOD_OPTIONS.map(({ days, label }) => (
        <button
          key={days}
          onClick={() => {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("days", String(days));
            setSearchParams(newParams);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentDays === days
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
