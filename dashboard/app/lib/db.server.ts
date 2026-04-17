import type {
  IngestPayload,
  KpiData,
  UserRankingEntry,
  UserEntry,
  DistributionEntry,
  DailyTrendEntry,
  DailyToolUsageEntry,
  RecentSessionEntry,
  RepoEntry,
  DashboardData,
} from "./types";
import { calculateEstimatedCost } from "./cost";

export async function upsertUser(
  db: D1Database,
  email: string
): Promise<number> {
  await db
    .prepare("INSERT OR IGNORE INTO users (email) VALUES (?)")
    .bind(email)
    .run();

  const row = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number }>();

  return row!.id;
}

export async function checkSessionExists(
  db: D1Database,
  sessionId: string
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM sessions WHERE session_id = ?")
    .bind(sessionId)
    .first();

  return row !== null;
}

export async function insertSessionAndEvents(
  db: D1Database,
  userId: number,
  payload: IngestPayload
): Promise<{
  skillEventsInserted: number;
  mcpEventsInserted: number;
  subagentEventsInserted: number;
}> {
  const { session, skill_events, mcp_events, subagent_events } = payload;

  const statements: D1PreparedStatement[] = [];

  // Insert session
  statements.push(
    db
      .prepare(
        `INSERT INTO sessions (
          session_id, user_id, project_dir, git_branch, claude_code_version,
          model, first_event_at, last_event_at,
          skill_call_count, mcp_call_count, subagent_call_count, conversation_turns,
          input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        session.session_id,
        userId,
        session.project_dir,
        session.git_branch ?? null,
        session.claude_code_version ?? null,
        session.model,
        session.first_event_at,
        session.last_event_at,
        skill_events.length,
        mcp_events.length,
        subagent_events.length,
        session.conversation_turns,
        session.input_tokens,
        session.output_tokens,
        session.cache_read_tokens,
        session.cache_creation_tokens
      )
  );

  // Insert skill events
  for (const event of skill_events) {
    statements.push(
      db
        .prepare(
          `INSERT INTO skill_usage_events (session_id, user_id, skill_name, timestamp)
           VALUES (?, ?, ?, ?)`
        )
        .bind(session.session_id, userId, event.skill_name, event.timestamp)
    );
  }

  // Insert MCP events
  for (const event of mcp_events) {
    statements.push(
      db
        .prepare(
          `INSERT INTO mcp_usage_events (session_id, user_id, tool_name, mcp_server, mcp_method, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          session.session_id,
          userId,
          event.tool_name,
          event.mcp_server,
          event.mcp_method,
          event.timestamp
        )
    );
  }

  // Insert subagent events
  for (const event of subagent_events) {
    statements.push(
      db
        .prepare(
          `INSERT INTO subagent_usage_events (session_id, user_id, subagent_type, timestamp)
           VALUES (?, ?, ?, ?)`
        )
        .bind(
          session.session_id,
          userId,
          event.subagent_type,
          event.timestamp
        )
    );
  }

  // D1 batch: up to 1000 bound parameters. Chunk if needed.
  const CHUNK_SIZE = 100;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    await db.batch(statements.slice(i, i + CHUNK_SIZE));
  }

  return {
    skillEventsInserted: skill_events.length,
    mcpEventsInserted: mcp_events.length,
    subagentEventsInserted: subagent_events.length,
  };
}

// SQL expression to extract repo name (last path segment) from project_dir
const REPO_NAME_EXPR = (prefix: string) => {
  const col = prefix ? `${prefix}.project_dir` : "project_dir";
  return `SUBSTR(${col}, LENGTH(RTRIM(${col}, REPLACE(${col}, '/', ''))) + 1)`;
};

/** Build WHERE clause and bind params for session-table queries */
function buildSessionFilter(
  hasDateFilter: boolean,
  dateFilter: string,
  userId: number | undefined,
  repo: string | undefined,
  prefix = "",
): { where: string; params: unknown[] } {
  const p = prefix ? `${prefix}.` : "";
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (hasDateFilter) {
    conditions.push(`${p}first_event_at >= datetime('now', ?)`);
    params.push(dateFilter);
  }
  if (userId !== undefined) {
    conditions.push(`${p}user_id = ?`);
    params.push(userId);
  }
  if (repo) {
    conditions.push(`${p}project_dir LIKE '%/' || ?`);
    params.push(repo);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

/** Build WHERE clause for event-table queries, optionally joining to sessions for repo filter */
function buildEventFilter(
  hasDateFilter: boolean,
  dateFilter: string,
  userId: number | undefined,
  repo: string | undefined,
  timestampCol: string,
  eventAlias: string,
): { join: string; where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let join = "";
  if (hasDateFilter) {
    conditions.push(`${eventAlias}.${timestampCol} >= datetime('now', ?)`);
    params.push(dateFilter);
  }
  if (userId !== undefined) {
    conditions.push(`${eventAlias}.user_id = ?`);
    params.push(userId);
  }
  if (repo) {
    join = `JOIN sessions _fs ON _fs.session_id = ${eventAlias}.session_id`;
    conditions.push(`_fs.project_dir LIKE '%/' || ?`);
    params.push(repo);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { join, where, params };
}

export async function getDashboardData(
  db: D1Database,
  days: number,
  userId?: number,
  repo?: string,
): Promise<DashboardData> {
  // days === 0 means "all time" — no date filter
  const hasDateFilter = days > 0;
  const dateFilter = `-${days} days`;

  // Pre-build common filter clauses
  const sf = buildSessionFilter(hasDateFilter, dateFilter, userId, repo);
  const sfJoin = buildSessionFilter(hasDateFilter, dateFilter, userId, repo, "s");

  // KPI aggregation
  const kpiRaw = await db.prepare(
    `SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(conversation_turns), 0) as total_conversation_turns,
      COALESCE(SUM(skill_call_count), 0) as total_skill_calls,
      COALESCE(SUM(mcp_call_count), 0) as total_mcp_calls,
      COALESCE(SUM(subagent_call_count), 0) as total_subagent_calls,
      COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens), 0) as total_tokens
    FROM sessions
    ${sf.where}`
  ).bind(...sf.params).first<Omit<KpiData, "total_estimated_cost">>();

  // KPI cost: aggregate per model then compute
  type ModelTokenRow = { model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  const kpiCostResult = await db.prepare(
    `SELECT model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens
    FROM sessions
    ${sf.where}
    GROUP BY model`
  ).bind(...sf.params).all<ModelTokenRow>();
  const totalEstimatedCost = kpiCostResult.results.reduce(
    (sum, r) => sum + calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens),
    0
  );

  const kpiResult: KpiData = {
    total_sessions: kpiRaw?.total_sessions ?? 0,
    total_conversation_turns: kpiRaw?.total_conversation_turns ?? 0,
    total_skill_calls: kpiRaw?.total_skill_calls ?? 0,
    total_mcp_calls: kpiRaw?.total_mcp_calls ?? 0,
    total_subagent_calls: kpiRaw?.total_subagent_calls ?? 0,
    total_tokens: kpiRaw?.total_tokens ?? 0,
    total_estimated_cost: totalEstimatedCost,
  };

  // User ranking by cost (aggregate per user+model, then compute cost in app)
  type UserModelRow = { user_id: number; email: string; model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; session_count: number };
  const userRankingRaw = await db.prepare(
    `SELECT u.id as user_id, u.email, s.model,
      SUM(s.input_tokens) as input_tokens,
      SUM(s.output_tokens) as output_tokens,
      SUM(s.cache_read_tokens) as cache_read_tokens,
      SUM(s.cache_creation_tokens) as cache_creation_tokens,
      COUNT(*) as session_count
    FROM sessions s JOIN users u ON s.user_id = u.id
    ${sfJoin.where}
    GROUP BY s.user_id, s.model`
  ).bind(...sfJoin.params).all<UserModelRow>();

  const userMap = new Map<number, { user_id: number; email: string; total_cost: number; total_sessions: number }>();
  for (const r of userRankingRaw.results) {
    const cost = calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens);
    const existing = userMap.get(r.user_id) ?? { user_id: r.user_id, email: r.email, total_cost: 0, total_sessions: 0 };
    existing.total_cost += cost;
    existing.total_sessions += r.session_count;
    userMap.set(r.user_id, existing);
  }
  const userRanking: UserRankingEntry[] = Array.from(userMap.values())
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10);

  // Skill distribution
  const skillEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");
  const skillDistResult = await db.prepare(
    `SELECT e.skill_name as name, COUNT(*) as count
    FROM skill_usage_events e ${skillEf.join}
    ${skillEf.where}
    GROUP BY e.skill_name
    ORDER BY count DESC`
  ).bind(...skillEf.params).all<DistributionEntry>();

  // MCP server distribution
  const mcpEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");
  const mcpDistResult = await db.prepare(
    `SELECT e.mcp_server as name, COUNT(*) as count
    FROM mcp_usage_events e ${mcpEf.join}
    ${mcpEf.where}
    GROUP BY e.mcp_server
    ORDER BY count DESC`
  ).bind(...mcpEf.params).all<DistributionEntry>();

  // Model distribution
  const modelDistResult = await db.prepare(
    `SELECT model as name, COUNT(*) as count
    FROM sessions
    ${sf.where}
    GROUP BY model
    ORDER BY count DESC`
  ).bind(...sf.params).all<DistributionEntry>();

  // Subagent distribution
  const subEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");
  const subagentDistResult = await db.prepare(
    `SELECT COALESCE(e.subagent_type, '(unspecified)') as name, COUNT(*) as count
    FROM subagent_usage_events e ${subEf.join}
    ${subEf.where}
    GROUP BY e.subagent_type
    ORDER BY count DESC`
  ).bind(...subEf.params).all<DistributionEntry>();

  // Daily cost/token trend (aggregate per date+model, compute cost in app)
  type DailyModelRow = { date: string; model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  const dailyTrendRaw = await db.prepare(
    `SELECT
      DATE(first_event_at) as date,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens
    FROM sessions
    ${sf.where}
    GROUP BY DATE(first_event_at), model
    ORDER BY date`
  ).bind(...sf.params).all<DailyModelRow>();

  const dailyMap = new Map<string, DailyTrendEntry>();
  for (const r of dailyTrendRaw.results) {
    const cost = calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens);
    const existing = dailyMap.get(r.date) ?? { date: r.date, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, estimated_cost: 0 };
    existing.input_tokens += r.input_tokens;
    existing.output_tokens += r.output_tokens;
    existing.cache_read_tokens += r.cache_read_tokens;
    existing.cache_creation_tokens += r.cache_creation_tokens;
    existing.estimated_cost += cost;
    dailyMap.set(r.date, existing);
  }
  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Daily tool usage — each sub-query needs its own filter
  const skillToolEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");
  const mcpToolEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");
  const subToolEf = buildEventFilter(hasDateFilter, dateFilter, userId, repo, "timestamp", "e");

  const dailyToolQuery = `SELECT
      date,
      SUM(skill_count) as skill_count,
      SUM(mcp_count) as mcp_count,
      SUM(subagent_count) as subagent_count
    FROM (
      SELECT DATE(e.timestamp) as date, COUNT(*) as skill_count, 0 as mcp_count, 0 as subagent_count
      FROM skill_usage_events e ${skillToolEf.join}
      ${skillToolEf.where}
      GROUP BY DATE(e.timestamp)
      UNION ALL
      SELECT DATE(e.timestamp) as date, 0, COUNT(*), 0
      FROM mcp_usage_events e ${mcpToolEf.join}
      ${mcpToolEf.where}
      GROUP BY DATE(e.timestamp)
      UNION ALL
      SELECT DATE(e.timestamp) as date, 0, 0, COUNT(*)
      FROM subagent_usage_events e ${subToolEf.join}
      ${subToolEf.where}
      GROUP BY DATE(e.timestamp)
    )
    GROUP BY date
    ORDER BY date`;
  const dailyToolResult = await db.prepare(dailyToolQuery)
    .bind(...skillToolEf.params, ...mcpToolEf.params, ...subToolEf.params)
    .all<DailyToolUsageEntry>();

  // Recent sessions
  type RecentSessionRow = Omit<RecentSessionEntry, "estimated_cost_usd">;
  const recentSessionsRaw = await db.prepare(
    `SELECT
      s.session_id, s.user_id, u.email,
      ${REPO_NAME_EXPR("s")} as repo_name,
      s.model, s.duration_seconds,
      s.conversation_turns, s.skill_call_count, s.mcp_call_count,
      s.subagent_call_count, s.input_tokens, s.output_tokens,
      s.cache_read_tokens, s.cache_creation_tokens, s.first_event_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    ${sfJoin.where}
    ORDER BY s.first_event_at DESC
    LIMIT 20`
  ).bind(...sfJoin.params).all<RecentSessionRow>();

  const recentSessions: RecentSessionEntry[] = recentSessionsRaw.results.map((r) => ({
    ...r,
    estimated_cost_usd: calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens),
  }));

  // Users list (date-filtered only, no user/repo filter so the selector always shows all users)
  const dateOnlyFilter = buildSessionFilter(hasDateFilter, dateFilter, undefined, undefined);
  const dateOnlyJoinFilter = buildSessionFilter(hasDateFilter, dateFilter, undefined, undefined, "s");
  const usersResult = await db.prepare(
    `SELECT u.id as user_id, u.email, COUNT(*) as session_count
    FROM sessions s JOIN users u ON s.user_id = u.id
    ${dateOnlyJoinFilter.where}
    GROUP BY u.id
    ORDER BY session_count DESC`
  ).bind(...dateOnlyJoinFilter.params).all<UserEntry>();

  // Repos list (date-filtered only, no user/repo filter so the selector always shows all repos)
  const reposResult = await db.prepare(
    `SELECT
      ${REPO_NAME_EXPR("")} as repo_name,
      COUNT(*) as session_count
    FROM sessions
    ${dateOnlyFilter.where}
    GROUP BY repo_name
    ORDER BY session_count DESC`
  ).bind(...dateOnlyFilter.params).all<RepoEntry>();

  // Look up user email for filter display
  let filterUserEmail: string | undefined;
  if (userId !== undefined) {
    const userRow = await db.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string }>();
    filterUserEmail = userRow?.email;
  }

  return {
    kpi: kpiResult,
    userRanking,
    skillDistribution: skillDistResult.results,
    mcpDistribution: mcpDistResult.results,
    modelDistribution: modelDistResult.results,
    subagentDistribution: subagentDistResult.results,
    dailyTrend,
    dailyToolUsage: dailyToolResult.results,
    recentSessions,
    users: usersResult.results,
    repos: reposResult.results,
    days,
    filterUserId: userId,
    filterUserEmail,
    filterRepo: repo,
  };
}
