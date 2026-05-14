// --- Ingest API types ---

export interface SessionData {
  session_id: string;
  project_dir: string;
  git_branch?: string;
  claude_code_version?: string;
  model: string;
  first_event_at: string;
  last_event_at: string;
  conversation_turns: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export interface SkillEvent {
  skill_name: string;
  timestamp: string;
}

export interface McpEvent {
  tool_name: string;
  mcp_server: string;
  mcp_method: string;
  timestamp: string;
}

export interface SubagentEvent {
  subagent_type: string | null;
  timestamp: string;
}

export interface IngestPayload {
  email: string;
  session: SessionData;
  skill_events: SkillEvent[];
  mcp_events: McpEvent[];
  subagent_events: SubagentEvent[];
}

// --- Dashboard data types ---

export interface KpiData {
  total_sessions: number;
  total_conversation_turns: number;
  total_skill_calls: number;
  total_mcp_calls: number;
  total_subagent_calls: number;
  total_estimated_cost: number;
  total_tokens: number;
}

export interface UserRankingEntry {
  user_id: number;
  email: string;
  total_cost: number;
  total_sessions: number;
}

export interface UserEntry {
  user_id: number;
  email: string;
  session_count: number;
}

export interface RepoEntry {
  repo_name: string;
  session_count: number;
}

export interface DistributionEntry {
  name: string;
  count: number;
}

export interface DailyTrendEntry {
  date: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  estimated_cost: number;
}

export interface DailyToolUsageEntry {
  date: string;
  skill_count: number;
  mcp_count: number;
  subagent_count: number;
}

export interface RecentSessionEntry {
  session_id: string;
  user_id: number;
  email: string;
  repo_name: string;
  model: string;
  duration_seconds: number;
  conversation_turns: number;
  skill_call_count: number;
  mcp_call_count: number;
  subagent_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  estimated_cost_usd: number;
  last_event_at: string;
}

export interface DashboardData {
  kpi: KpiData;
  userRanking: UserRankingEntry[];
  skillDistribution: DistributionEntry[];
  mcpDistribution: DistributionEntry[];
  modelDistribution: DistributionEntry[];
  subagentDistribution: DistributionEntry[];
  dailyTrend: DailyTrendEntry[];
  dailyToolUsage: DailyToolUsageEntry[];
  recentSessions: RecentSessionEntry[];
  users: UserEntry[];
  repos: RepoEntry[];
  days: number;
  filterUserId?: number;
  filterUserEmail?: string;
  filterRepo?: string;
}
