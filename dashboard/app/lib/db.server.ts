import type {
  IngestPayload,
  KpiData,
  UserRankingEntry,
  DistributionEntry,
  DailyTrendEntry,
  DailyToolUsageEntry,
  RecentSessionEntry,
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

export async function getDashboardData(
  db: D1Database,
  days: number
): Promise<DashboardData> {
  // days === 0 means "all time" — no date filter
  const hasDateFilter = days > 0;
  const dateFilter = `-${days} days`;

  // Helper to build WHERE clause
  const sessionDateWhere = hasDateFilter
    ? "WHERE first_event_at >= datetime('now', ?)"
    : "";
  const eventDateWhere = (col: string) =>
    hasDateFilter ? `WHERE ${col} >= datetime('now', ?)` : "";
  const sessionJoinDateWhere = hasDateFilter
    ? "WHERE s.first_event_at >= datetime('now', ?)"
    : "";

  // KPI aggregation
  const kpiStmt = db.prepare(
    `SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(conversation_turns), 0) as total_conversation_turns,
      COALESCE(SUM(skill_call_count), 0) as total_skill_calls,
      COALESCE(SUM(mcp_call_count), 0) as total_mcp_calls,
      COALESCE(SUM(subagent_call_count), 0) as total_subagent_calls,
      COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens), 0) as total_tokens
    FROM sessions
    ${sessionDateWhere}`
  );
  const kpiRaw = await (hasDateFilter
    ? kpiStmt.bind(dateFilter)
    : kpiStmt
  ).first<Omit<KpiData, "total_estimated_cost">>();

  // KPI cost: aggregate per model then compute
  const kpiCostStmt = db.prepare(
    `SELECT model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens
    FROM sessions
    ${sessionDateWhere}
    GROUP BY model`
  );
  type ModelTokenRow = { model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  const kpiCostResult = await (hasDateFilter
    ? kpiCostStmt.bind(dateFilter)
    : kpiCostStmt
  ).all<ModelTokenRow>();
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
  const userRankingStmt = db.prepare(
    `SELECT u.email, s.model,
      SUM(s.input_tokens) as input_tokens,
      SUM(s.output_tokens) as output_tokens,
      SUM(s.cache_read_tokens) as cache_read_tokens,
      SUM(s.cache_creation_tokens) as cache_creation_tokens,
      COUNT(*) as session_count
    FROM sessions s JOIN users u ON s.user_id = u.id
    ${sessionJoinDateWhere}
    GROUP BY s.user_id, s.model`
  );
  type UserModelRow = { email: string; model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; session_count: number };
  const userRankingRaw = await (hasDateFilter
    ? userRankingStmt.bind(dateFilter)
    : userRankingStmt
  ).all<UserModelRow>();

  const userMap = new Map<string, { total_cost: number; total_sessions: number }>();
  for (const r of userRankingRaw.results) {
    const cost = calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens);
    const existing = userMap.get(r.email) ?? { total_cost: 0, total_sessions: 0 };
    existing.total_cost += cost;
    existing.total_sessions += r.session_count;
    userMap.set(r.email, existing);
  }
  const userRanking: UserRankingEntry[] = Array.from(userMap.entries())
    .map(([email, data]) => ({ email, ...data }))
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10);

  // Skill distribution
  const skillDistStmt = db.prepare(
    `SELECT skill_name as name, COUNT(*) as count
    FROM skill_usage_events
    ${eventDateWhere("timestamp")}
    GROUP BY skill_name
    ORDER BY count DESC`
  );
  const skillDistResult = await (hasDateFilter
    ? skillDistStmt.bind(dateFilter)
    : skillDistStmt
  ).all<DistributionEntry>();

  // MCP server distribution
  const mcpDistStmt = db.prepare(
    `SELECT mcp_server as name, COUNT(*) as count
    FROM mcp_usage_events
    ${eventDateWhere("timestamp")}
    GROUP BY mcp_server
    ORDER BY count DESC`
  );
  const mcpDistResult = await (hasDateFilter
    ? mcpDistStmt.bind(dateFilter)
    : mcpDistStmt
  ).all<DistributionEntry>();

  // Model distribution
  const modelDistStmt = db.prepare(
    `SELECT model as name, COUNT(*) as count
    FROM sessions
    ${sessionDateWhere}
    GROUP BY model
    ORDER BY count DESC`
  );
  const modelDistResult = await (hasDateFilter
    ? modelDistStmt.bind(dateFilter)
    : modelDistStmt
  ).all<DistributionEntry>();

  // Subagent distribution
  const subagentDistStmt = db.prepare(
    `SELECT COALESCE(subagent_type, '(unspecified)') as name, COUNT(*) as count
    FROM subagent_usage_events
    ${eventDateWhere("timestamp")}
    GROUP BY subagent_type
    ORDER BY count DESC`
  );
  const subagentDistResult = await (hasDateFilter
    ? subagentDistStmt.bind(dateFilter)
    : subagentDistStmt
  ).all<DistributionEntry>();

  // Daily cost/token trend (aggregate per date+model, compute cost in app)
  const dailyTrendStmt = db.prepare(
    `SELECT
      DATE(first_event_at) as date,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens
    FROM sessions
    ${sessionDateWhere}
    GROUP BY DATE(first_event_at), model
    ORDER BY date`
  );
  type DailyModelRow = { date: string; model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number };
  const dailyTrendRaw = await (hasDateFilter
    ? dailyTrendStmt.bind(dateFilter)
    : dailyTrendStmt
  ).all<DailyModelRow>();

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

  // Daily tool usage
  const skillSubWhere = hasDateFilter
    ? "WHERE timestamp >= datetime('now', ?)"
    : "";
  const dailyToolQuery = `SELECT
      date,
      SUM(skill_count) as skill_count,
      SUM(mcp_count) as mcp_count,
      SUM(subagent_count) as subagent_count
    FROM (
      SELECT DATE(timestamp) as date, COUNT(*) as skill_count, 0 as mcp_count, 0 as subagent_count
      FROM skill_usage_events ${skillSubWhere}
      GROUP BY DATE(timestamp)
      UNION ALL
      SELECT DATE(timestamp) as date, 0, COUNT(*), 0
      FROM mcp_usage_events ${skillSubWhere}
      GROUP BY DATE(timestamp)
      UNION ALL
      SELECT DATE(timestamp) as date, 0, 0, COUNT(*)
      FROM subagent_usage_events ${skillSubWhere}
      GROUP BY DATE(timestamp)
    )
    GROUP BY date
    ORDER BY date`;
  const dailyToolStmt = db.prepare(dailyToolQuery);
  const dailyToolResult = await (hasDateFilter
    ? dailyToolStmt.bind(dateFilter, dateFilter, dateFilter)
    : dailyToolStmt
  ).all<DailyToolUsageEntry>();

  // Recent sessions
  const recentSessionsStmt = db.prepare(
    `SELECT
      s.session_id, u.email, s.model, s.duration_seconds,
      s.conversation_turns, s.skill_call_count, s.mcp_call_count,
      s.subagent_call_count, s.input_tokens, s.output_tokens,
      s.cache_read_tokens, s.cache_creation_tokens, s.first_event_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    ${sessionJoinDateWhere}
    ORDER BY s.first_event_at DESC
    LIMIT 20`
  );
  type RecentSessionRow = Omit<RecentSessionEntry, "estimated_cost_usd">;
  const recentSessionsRaw = await (hasDateFilter
    ? recentSessionsStmt.bind(dateFilter)
    : recentSessionsStmt
  ).all<RecentSessionRow>();

  const recentSessions: RecentSessionEntry[] = recentSessionsRaw.results.map((r) => ({
    ...r,
    estimated_cost_usd: calculateEstimatedCost(r.model, r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_creation_tokens),
  }));

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
    days,
  };
}
