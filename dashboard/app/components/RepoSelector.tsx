import { useSearchParams } from "react-router";
import type { RepoEntry } from "~/lib/types";

export function RepoSelector({ repos }: { repos: RepoEntry[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentRepo = searchParams.get("repo") || "";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value) {
      newParams.set("repo", e.target.value);
    } else {
      newParams.delete("repo");
    }
    setSearchParams(newParams);
  };

  if (repos.length === 0) return null;

  return (
    <select
      value={currentRepo}
      onChange={handleChange}
      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All Repositories</option>
      {repos.map((r) => (
        <option key={r.repo_name} value={r.repo_name}>
          {r.repo_name} ({r.session_count})
        </option>
      ))}
    </select>
  );
}
