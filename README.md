# Claude Code Usage Dashboard

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) の利用状況をチームで可視化・共有できるセルフホスト型ダッシュボードです。

セッション終了時に Stop フックがトランスクリプトを自動解析・保存し、トークン消費量、スキル・MCP・サブエージェントの利用状況、推定コストなどをチャートで表示します。

![ダッシュボード](docs/images/dashboard-screenshot.png)

## 主な機能

- **Claude Codeデータ収集** — Stop フックによるゼロコンフィグのデータ収集
- **トークン・コスト追跡** — input / output / cache read / cache creation トークンとモデル別コスト推定
- **スキル利用分析** — `/commit`, `/fixissue` 等のスキル呼び出し頻度
- **MCP サーバー分析** — MCP サーバー名・メソッド別の呼び出し状況
- **サブエージェント分析** — Agent ツールの利用状況（Explore, Plan 等）
- **チーム概況** — ユーザー別コストランキング、日次トレンド、モデル分布


## セットアップ

### 1. プラグインのインストール

対象プロジェクトにプラグインをインストールすると、Claude Code セッション終了時にダッシュボードへ利用データが自動送信されます。

```bash
# マーケットプレイス登録（ローカルマシンに登録されるだけで、外部に公開はされません）
claude plugin marketplace add https://github.com/sec-dev-lab/ClaudeCodeDashboard.git

# プラグインインストール（対象プロジェクトのみに適用）
claude plugin install claude-code-usage-dashboard-plugin@sec-dev-lab --scope project
```

### 2. 環境変数の設定

対象プロジェクトルートの `.env` に、ダッシュボードの URL を追加します。

```bash
# ローカル起動の場合（cd dashboard && npm run dev）
CLAUDE_CODE_USAGE_DASHBOARD_URL=http://localhost:5173

# デプロイ済みのダッシュボード
CLAUDE_CODE_USAGE_DASHBOARD_URL=https://dashboard.your-account.workers.dev
```

### アンインストール

```bash
/plugin uninstall claude-code-usage-dashboard-plugin
```


## アーキテクチャ

```
Claude Code セッション終了
  │
  ▼
Stop hook (session-uploader.py)
  │  ~/.claude/projects/{hash}/{session_id}.jsonl をパース
  │  トークン、スキル、MCP 呼び出し、サブエージェントイベントを抽出
  │
  ▼
POST /api/v1/usage/ingest
  │
  ▼
Web アプリケーション (React Router v7 SSR)
  │
  ▼
データベース (SQLite)
  │
  ▼
ダッシュボード UI (Recharts)
```

## データ収集フック

Stop フック（`hooks/session-uploader.py`）は Claude Code セッション終了時に自動実行されます。

### 収集データ

| データ | 説明 |
|-------|------|
| セッション情報 | session_id, プロジェクト, ブランチ, モデル, タイムスタンプ, 会話ターン数 |
| トークン | input, output, cache_read, cache_creation |
| スキルイベント | `/commit`, `/fixissue` 等（`<command-message>` タグから抽出） |
| MCP イベント | サーバー名, メソッド名（例: `notion/notion-fetch`） |
| サブエージェントイベント | エージェントタイプ（Explore, Plan 等） |

> 推定コストは DB に保存せず、表示時にトークン数とモデルから料金テーブルを使って動的に計算します。



## プロジェクト構成

```
ClaudeCodeDashboard/
├── .claude-plugin/
│   └── marketplace.json             # マーケットプレイス定義
├── plugin/                          # プラグイン本体
│   ├── .claude-plugin/
│   │   └── plugin.json              # プラグインメタデータ
│   └── hooks/
│       ├── hooks.json               # フック定義
│       └── session-uploader.py      # Stop フック（トランスクリプト解析 + API 送信）
├── dashboard/
│   ├── app/
│   │   ├── routes/              # ダッシュボードページ + Ingest API
│   │   ├── components/          # チャート・UI コンポーネント
│   │   └── lib/                 # 型定義, DB クエリ, コスト計算
│   ├── migrations/              # D1 スキーマ
│   └── workers/                 # Workers エントリポイント
└── README.md
```

