#!/usr/bin/env bash
set -euo pipefail

WRANGLER_TOML="dashboard/wrangler.toml"

usage() {
  echo "Usage: $0 <database_id>"
  echo ""
  echo "Set the D1 database_id and deploy the dashboard."
  echo ""
  echo "Example:"
  echo "  $0 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  exit 1
}

if [[ $# -ne 1 ]]; then
  usage
fi

DATABASE_ID="$1"

if [[ ! -f "$WRANGLER_TOML" ]]; then
  echo "Error: $WRANGLER_TOML not found. Run from the repository root." >&2
  exit 1
fi

echo "Setting database_id..."
sed -i '' "s|database_id = \".*\"|database_id = \"$DATABASE_ID\"|" "$WRANGLER_TOML"
echo "database_id set: $DATABASE_ID"

echo ""
echo "Deploying..."
cd dashboard
npm install
npx wrangler d1 migrations apply claude-code-usage-dashboard --remote
npm run deploy
