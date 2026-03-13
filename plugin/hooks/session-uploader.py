#!/usr/bin/env python3
"""Claude Code Stop hook: parse transcript and upload usage data to dashboard.

This is a standalone CLI script for external API communication.
JSON serialization is required for HTTP POST to the dashboard ingest API.

Transcript format reference:
  https://platform.claude.com/docs/en/agent-sdk/typescript
"""

import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

# Built-in CLI commands that are not user-defined skills
BUILTIN_COMMANDS = frozenset(
    {
        "exit",
        "help",
        "clear",
        "compact",
        "cost",
        "doctor",
        "init",
        "login",
        "logout",
        "memory",
        "permissions",
        "review",
        "status",
        "terminal-setup",
        "vim",
        "fast",
        "effort",
    }
)


def main() -> None:
    session_info = json.loads(sys.stdin.read())
    session_id = session_info.get("session_id")
    if not session_id:
        return

    transcript_path = find_transcript(session_id)
    if not transcript_path:
        return

    email = get_email()
    if not email:
        return

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    load_dotenv(os.path.join(project_dir, ".env"))

    dashboard_url = os.environ.get(
        "CLAUDE_CODE_USAGE_DASHBOARD_URL", "http://localhost:5173"
    )
    if not dashboard_url:
        return

    records = read_jsonl(transcript_path)
    payload = parse_transcript(records)
    if not payload:
        return

    payload["email"] = email
    post_to_api(dashboard_url, payload)


def find_transcript(session_id: str):
    claude_dir = Path.home() / ".claude" / "projects"
    if not claude_dir.exists():
        return None
    for path in claude_dir.rglob(f"{session_id}.jsonl"):
        return path
    return None


def get_email():
    try:
        result = subprocess.run(
            ["claude", "auth", "status"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        data = json.loads(result.stdout)
        return data.get("email") or None
    except Exception:
        return None


def load_dotenv(path: str) -> None:
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                value = value.strip().strip("'\"")
                os.environ.setdefault(key.strip(), value)
    except FileNotFoundError:
        pass


def read_jsonl(path):
    records = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return records


def extract_user_skill_events(records):
    """Extract skill events from user messages containing <command-message> tags.

    When users invoke skills via /fixissue, /commit etc., Claude Code records
    them as user messages with <command-message>fixissue</command-message> tags.
    """
    command_msg_re = re.compile(r"<command-message>([^<]+)</command-message>")
    skill_events = []
    seen = set()

    for rec in records:
        if rec.get("type") != "user":
            continue
        timestamp = rec.get("timestamp", "")
        texts = _extract_texts(rec.get("message", {}))

        for text in texts:
            for match in command_msg_re.finditer(text):
                skill_name = match.group(1).strip()
                if skill_name in BUILTIN_COMMANDS:
                    continue
                dedup_key = (skill_name, timestamp)
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)
                skill_events.append(
                    {
                        "skill_name": skill_name,
                        "timestamp": timestamp,
                    }
                )

    return skill_events


def _extract_texts(message):
    """Extract text strings from a user message (various formats)."""
    texts = []
    if type(message) is str:
        texts.append(message)
    elif type(message) is list:
        for item in message:
            if type(item) is dict:
                texts.append(item.get("text", ""))
    elif type(message) is dict:
        content = message.get("content", "")
        if type(content) is str:
            texts.append(content)
        elif type(content) is list:
            for item in content:
                if type(item) is dict:
                    texts.append(item.get("text", ""))
    return texts


def parse_transcript(records):
    assistant_recs = [
        r
        for r in records
        if r.get("type") == "assistant"
        and type(r.get("message", {}).get("content")) is list
    ]

    if not assistant_recs:
        return None

    # Extract all tool_use entries, deduplicated by id (last wins)
    tool_uses = {}
    for rec in assistant_recs:
        timestamp = rec.get("timestamp", "")
        for content in rec["message"]["content"]:
            if content.get("type") != "tool_use":
                continue
            tool_id = content.get("id", "")
            tool_uses[tool_id] = {
                "id": tool_id,
                "name": content.get("name", ""),
                "input": content.get("input", {}),
                "timestamp": timestamp,
            }
    all_tools = list(tool_uses.values())

    # Classify tools into MCP / Subagent / Skill
    skill_events = []
    mcp_events = []
    subagent_events = []

    for tool in all_tools:
        name = tool["name"]
        ts = tool["timestamp"]

        if name.startswith("mcp__"):
            # MCP: tool name = "mcp__<server>__<method>"
            # e.g. "mcp__notion__notion-fetch" → server="notion", method="notion-fetch"
            parts = name.split("__")
            mcp_events.append(
                {
                    "tool_name": name,
                    "mcp_server": parts[1] if len(parts) > 1 else "unknown",
                    "mcp_method": "__".join(parts[2:]) if len(parts) > 2 else "",
                    "timestamp": ts,
                }
            )
        elif name == "Agent":
            # Subagent: tool name = "Agent", input.subagent_type = "Explore" | "Plan" | etc.
            subagent_events.append(
                {
                    "subagent_type": tool["input"].get("subagent_type"),
                    "timestamp": ts,
                }
            )

    # Skill: extracted from user records containing <command-message> tags
    # e.g. <command-message>commit</command-message> → skill_name="commit"
    user_skill_events = extract_user_skill_events(records)
    skill_events.extend(user_skill_events)

    # Token aggregation (deduplicate by message id, last wins)
    messages_by_id = {}
    for rec in assistant_recs:
        msg = rec.get("message", {})
        msg_id = msg.get("id", id(rec))
        messages_by_id[msg_id] = msg

    input_tokens = 0
    output_tokens = 0
    cache_read_tokens = 0
    cache_creation_tokens = 0
    for msg in messages_by_id.values():
        usage = msg.get("usage", {})
        input_tokens += usage.get("input_tokens", 0)
        output_tokens += usage.get("output_tokens", 0)
        cache_read_tokens += usage.get("cache_read_input_tokens", 0)
        cache_creation_tokens += usage.get("cache_creation_input_tokens", 0)

    # Model: most frequent
    model_counter = Counter(
        msg.get("model", "unknown") for msg in messages_by_id.values()
    )
    model = model_counter.most_common(1)[0][0] if model_counter else "unknown"

    # Conversation turns
    conversation_turns = sum(1 for r in records if r.get("type") == "user")

    # Timestamps
    timestamps = sorted(
        r["timestamp"]
        for r in records
        if type(r.get("timestamp")) is str and r["timestamp"]
    )

    first_rec = assistant_recs[0]

    return {
        "session": {
            "session_id": first_rec.get("sessionId", "unknown"),
            "project_dir": first_rec.get("cwd", "unknown"),
            "git_branch": first_rec.get("gitBranch"),
            "claude_code_version": first_rec.get("version"),
            "model": model,
            "first_event_at": timestamps[0] if timestamps else "",
            "last_event_at": timestamps[-1] if timestamps else "",
            "conversation_turns": conversation_turns,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_read_tokens": cache_read_tokens,
            "cache_creation_tokens": cache_creation_tokens,
        },
        "skill_events": skill_events,
        "mcp_events": mcp_events,
        "subagent_events": subagent_events,
    }


def post_to_api(dashboard_url, payload) -> None:
    url = urljoin(dashboard_url.rstrip("/") + "/", "api/v1/usage/ingest")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "claude-code-usage-dashboard/1.0",  # Botと判定されないようにするため
    }

    client_id = os.environ.get("CLAUDE_CODE_USAGE_DASHBOARD_CF_ACCESS_CLIENT_ID", "")
    client_secret = os.environ.get("CLAUDE_CODE_USAGE_DASHBOARD_CF_ACCESS_CLIENT_SECRET", "")
    if client_id and client_secret:
        headers["CF-Access-Client-Id"] = client_id
        headers["CF-Access-Client-Secret"] = client_secret

    data = json.dumps(payload).encode()
    req = Request(url, data=data, headers=headers, method="POST")
    try:
        urlopen(req, timeout=30)
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
