# Hermes Wiki Engine

Hermes Wiki Engine 是 local-first 的 Joplin wiki CLI。它把 Joplin 筆記同步成可重建的本機 artifacts，讓 AI agent 可以用 `wiki query`、`wiki read`、`wiki links` 查詢 source-backed memory。

Joplin 仍是長期知識庫 single source of truth。除了 `wiki approve` 以外，其他命令不得寫入 Joplin notes。

## Quickstart

需求：

- Node.js 20 或更新版本。
- Joplin Desktop 開啟 Data API。
- 一組 Joplin Data API token。

從 checkout 安裝：

```zsh
npm install -g .
```

建立本機設定：

```zsh
cp .env.example .env
```

編輯 `.env`，至少設定：

```zsh
export WIKI_STATE_DIR="$HOME/.local/state/hermes-wiki-engine"
export WIKI_JOPLIN_API_URL="http://127.0.0.1:41184"
export WIKI_JOPLIN_TOKEN="<your-joplin-data-api-token>"
```

載入設定後先確認 CLI 可用：

```zsh
source .env
wiki status
```

同步與編譯：

```zsh
wiki sync
wiki compile
wiki query "問題"
wiki read <ref>
wiki links <ref>
```

`wiki sync` 只讀 Joplin Data API 並更新 raw cache。`wiki compile` 從本機 raw cache 建立 compiled pages、graph 與 schema。`wiki query`、`wiki read`、`wiki links` 只讀已完成的本機 artifacts，不會在前台查詢時臨時重編全庫。

## Commands

```zsh
wiki status
wiki sync
wiki compile
wiki query "問題"
wiki read <ref>
wiki links <ref>
wiki audit
wiki automate once --draft-top <N> --notify
wiki automate status
wiki draft candidates --limit 10
wiki draft candidate <candidate-id> --target-notebook <notebook-id>
wiki draft consolidate --target-notebook <notebook-id> --ref note:<id> "整理目標"
wiki draft llm-consolidate --target-notebook <notebook-id> --ref note:<id> "整理目標"
wiki draft reject <draft-id>
wiki semantic build
wiki semantic query "問題"
wiki capture telegram --input <path>
wiki capture discord --input <path>
wiki notify discord --message "訊息"
wiki approve <draft-id>
```

## Safety Model

- Joplin 是長期知識庫 SSOT。
- Joplin 整合只走 Joplin Data API，不直接讀寫 Joplin SQLite 或 profile。
- `wiki sync`、`wiki compile`、`wiki query`、`wiki read`、`wiki links`、`wiki audit`、candidate discovery、automation、capture、draft creation 都不得寫入 Joplin notes。
- `wiki approve <draft-id>` 是唯一正式 Joplin writeback gate。
- Telegram／Discord 是 capture source，只能先產生 filesystem draft，人工 review 後再 approve。
- Token、webhook URL、allowlist、`.env`、state directory、raw cache、generated drafts 不得進 git。

## Hermes Runtime Profile

開源 quickstart 不需要 `/Users/hermes`。Hermes runtime 是進階部署 profile，預期 layout：

```text
/Users/hermes/projects/hermes-wiki-engine
/Users/hermes/.local/bin/wiki
/Users/hermes/.hermes/skills/wiki/SKILL.md
/Users/hermes/knowledge/
/Users/hermes/.config/hermes-knowledge/env
```

Hermes skill guidance 位於 `packaging/hermes/skills/wiki/SKILL.md`。Hermes 前台回答記憶問題時仍必須走 `wiki query`、`wiki read`、`wiki links`，不得把 draft 或 semantic score 當成事實來源。

## Development

```zsh
npm test
npm pack --dry-run
spectra validate open-source-file-structure
```

檔案架構與 publish 邊界見 `docs/open-source-file-structure.md`。
