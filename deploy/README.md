# Deployment Guide

Steps to deploy `dashboard/` to Cloudflare Workers + D1.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed and logged in

```bash
npm install -g wrangler
wrangler login
```

## Initial Setup

### 1. Create a D1 database

```bash
wrangler d1 create claude-code-usage
```

Example output:

```
✅ Successfully created DB 'claude-code-usage'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. Deploy

Run the deploy script with the `database_id` from the previous step.
It sets the database_id, applies migrations, and deploys in one step.

```bash
./deploy/deploy.sh <database_id>
```

The Workers URL will be displayed after deployment (e.g. `https://claude-code-usage-dashboard.<account>.workers.dev`).

Subsequent deployments can use the same command.

## Zero Trust Setup (Optional — one-time manual setup)

> This section is optional and provided as a reference. The dashboard works without Zero Trust. Configure it only if you need access control in your environment.

Configure access control with Cloudflare Zero Trust.
A single Access Application handles two types of authentication: dashboard access (browser) and Ingest API (SessionEnd hook).

### Step 1: Create an Access Application

1. [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) → **Access controls** → **Applications**
2. **Add an application** → Select **Self-hosted**
3. Set Basic information:

| Field | Value |
|-------|-------|
| Application name | `Claude Code Usage Dashboard` |
| Session Duration | `24 hours` (optional) |

4. Click **+ Add public hostname** and enter the Workers URL:

| Field | Value |
|-------|-------|
| Subdomain | `claude-code-usage-dashboard` |
| Domain | `<account>.workers.dev` |

### Step 2: Dashboard access policy

Create the first Policy in the Application. Configure according to your organization's authentication requirements.

Example:

| Field | Value |
|-------|-------|
| Policy name | `Allow Developer members` |
| Action | **Allow** |
| Include rule | Emails ending in `@example.com` |
| Identity providers | Select **Google** |


### Step 3: Create a Service Token (for Ingest API)

Create a Service Token for API submissions from the SessionEnd hook.

1. Zero Trust dashboard → **Access control** → **Service Credentials** → **Service Tokens**
2. Click **Create Service Token**
3. Name: `Claude Code Usage Dashboard Ingest`
4. Save the issued `CF-Access-Client-Id` and `CF-Access-Client-Secret`


### Step 4: Add a Service Token policy

Add a second Policy to the Access Application created in Step 1:

| Field | Value |
|-------|-------|
| Policy name | `Allow Ingest API Service Token` |
| Action | **Service Auth** |
| Include rule | Service Token → Select `Claude Code Usage Dashboard Ingest` |

This allows requests with `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers to pass authentication.


## Team Distribution

Each team member installs the plugin and sets environment variables.
See the "Setup" section in the root [README.md](../README.md).

When using Zero Trust, also add the following to `.env`:

```bash
CLAUDE_CODE_USAGE_DASHBOARD_CF_ACCESS_CLIENT_ID="<Client ID>"
CLAUDE_CODE_USAGE_DASHBOARD_CF_ACCESS_CLIENT_SECRET="<Client Secret>"
```

## Schema Updates

When new migration SQL files are added to `migrations/`:

```bash
wrangler d1 migrations apply claude-code-usage-dashboard --remote
```

> For local environments, use the `--local` flag.

## DB Reset (Delete all data + recreate schema)

Use this to reset the DB to a clean state, e.g. after breaking schema changes.

> **Warning**: All data will be deleted. Use with caution in production.

```bash
cd dashboard

# 1. Drop all tables and migration history
wrangler d1 execute claude-code-usage-dashboard --remote --command "DROP TABLE IF EXISTS subagent_usage_events; DROP TABLE IF EXISTS mcp_usage_events; DROP TABLE IF EXISTS skill_usage_events; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS d1_migrations;"

# 2. Re-apply migrations
wrangler d1 migrations apply claude-code-usage-dashboard --remote
```
