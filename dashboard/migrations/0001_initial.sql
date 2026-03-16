-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_dir TEXT NOT NULL,
  git_branch TEXT,
  claude_code_version TEXT,
  model TEXT NOT NULL,
  first_event_at TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CAST((julianday(last_event_at) - julianday(first_event_at)) * 86400 AS INTEGER)
  ) STORED,
  skill_call_count INTEGER NOT NULL DEFAULT 0,
  mcp_call_count INTEGER NOT NULL DEFAULT 0,
  subagent_call_count INTEGER NOT NULL DEFAULT 0,
  conversation_turns INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_first_event ON sessions(first_event_at);
CREATE INDEX idx_sessions_model ON sessions(model);

-- Skill usage events table
CREATE TABLE skill_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_skill_events_user_id ON skill_usage_events(user_id);
CREATE INDEX idx_skill_events_session_id ON skill_usage_events(session_id);
CREATE INDEX idx_skill_events_timestamp ON skill_usage_events(timestamp);
CREATE INDEX idx_skill_events_skill_name ON skill_usage_events(skill_name);
CREATE INDEX idx_skill_events_user_timestamp ON skill_usage_events(user_id, timestamp);

-- MCP usage events table
CREATE TABLE mcp_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tool_name TEXT NOT NULL,
  mcp_server TEXT NOT NULL,
  mcp_method TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mcp_events_user_id ON mcp_usage_events(user_id);
CREATE INDEX idx_mcp_events_session_id ON mcp_usage_events(session_id);
CREATE INDEX idx_mcp_events_timestamp ON mcp_usage_events(timestamp);
CREATE INDEX idx_mcp_events_mcp_server ON mcp_usage_events(mcp_server);
CREATE INDEX idx_mcp_events_user_timestamp ON mcp_usage_events(user_id, timestamp);

-- Subagent usage events table
CREATE TABLE subagent_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subagent_type TEXT,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subagent_events_user_id ON subagent_usage_events(user_id);
CREATE INDEX idx_subagent_events_session_id ON subagent_usage_events(session_id);
CREATE INDEX idx_subagent_events_timestamp ON subagent_usage_events(timestamp);
CREATE INDEX idx_subagent_events_type ON subagent_usage_events(subagent_type);
CREATE INDEX idx_subagent_events_user_timestamp ON subagent_usage_events(user_id, timestamp);
