import { useSearchParams } from "react-router";
import type { UserEntry } from "~/lib/types";

export function UserSelector({ users }: { users: UserEntry[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = searchParams.get("user_id") || "";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value) {
      newParams.set("user_id", e.target.value);
    } else {
      newParams.delete("user_id");
    }
    setSearchParams(newParams);
  };

  if (users.length === 0) return null;

  return (
    <select
      value={currentUserId}
      onChange={handleChange}
      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All Users</option>
      {users.map((u) => (
        <option key={u.user_id} value={u.user_id}>
          {u.email.split("@")[0]} ({u.session_count})
        </option>
      ))}
    </select>
  );
}
