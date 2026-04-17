import { useSearchParams } from "react-router";

export function ActiveFilters({
  filterUserEmail,
  filterRepo,
}: {
  filterUserEmail?: string;
  filterRepo?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const removeFilter = (key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams);
  };

  const clearAll = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("user_id");
    newParams.delete("repo");
    setSearchParams(newParams);
  };

  if (!filterUserEmail && !filterRepo) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Filters:
      </span>
      {filterUserEmail && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          User: {filterUserEmail.split("@")[0]}
          <button
            onClick={() => removeFilter("user_id")}
            className="ml-0.5 hover:text-blue-600 dark:hover:text-blue-100"
            aria-label="Remove user filter"
          >
            &times;
          </button>
        </span>
      )}
      {filterRepo && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Repo: {filterRepo}
          <button
            onClick={() => removeFilter("repo")}
            className="ml-0.5 hover:text-green-600 dark:hover:text-green-100"
            aria-label="Remove repo filter"
          >
            &times;
          </button>
        </span>
      )}
      {filterUserEmail && filterRepo && (
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
