# Hermes Wiki Engine

Hermes Wiki Engine 是搭配 Hermes 使用的 llm-wiki 筆記引擎。它把 Joplin 筆記同步、編譯成可重建的本機 wiki artifacts，讓 Hermes 透過 `wiki` command bridge 查詢、閱讀、追蹤連結，並自動化整理筆記庫內容。

這不是 Joplin 替代品，也不是 hosted RAG service。Joplin 仍是長期知識庫 single source of truth；Hermes 透過 `wiki sync`、`wiki compile`、`wiki query`、`wiki read`、`wiki links` 與 `wiki automate` 操作 source-backed knowledge flow。正式寫回 Joplin 的變更仍需經過 `wiki approve`。

Hermes 之外也能使用：你可以把它當成 standalone Joplin local-first wiki CLI，但需要自己決定由哪個 agent、script 或人工流程呼叫 `wiki`，並負責安排自動化整理的執行時機。

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

## Hermes Usage

Hermes deployment 可以把 `wiki` 裝成固定 command bridge，並在 Hermes skill 內要求長期記憶查詢都走：

```zsh
wiki query "問題"
wiki read <ref>
wiki links <ref>
```

Hermes 需要更新本機 wiki 時可以呼叫：

```zsh
wiki sync
wiki compile
```

Hermes skill guidance 位於 `packaging/hermes/skills/wiki/SKILL.md`。Hermes 前台回答記憶問題時仍必須使用 compiled source refs；pending draft、semantic score、automation summary 都不是正式事實來源。

## Automated Library Maintenance

`wiki automate once` 會執行一輪 review-gated 筆記庫整理流程：

```zsh
wiki automate once
wiki automate once --draft-top 2 --notify
wiki automate status
```

自動化流程會依序執行 sync、compile、candidate discovery 與 audit。加上 `--draft-top <N>` 時，它最多產生 N 份 LLM-assisted review drafts，方便 operator 後續審核。

自動化不會呼叫 `wiki approve`，不會寫入 Joplin notes，也不會替你永久決定 target notebook。若只想刷新 evidence 與 candidates，省略 `--draft-top` 或使用 `--draft-top 0`。

## Non-Hermes Usage

這個 CLI 也適合 Hermes 之外的本機使用場景：

- 個人 Joplin 筆記庫的 local-first search／read／link layer。
- 其他 AI agent 的 source-backed memory command bridge。
- cron、launchd 或手動 script 觸發的筆記庫整理流程。
- 先產生 reviewable drafts，再由人決定是否 approve 的知識沉澱流程。

它不提供 hosted multi-user service、Joplin sync server、web UI、daemon scheduler 或直接替代 Joplin 的筆記編輯體驗。若你不使用 Hermes，需要自行負責排程、operator review 與 agent 呼叫規則。

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

Hermes runtime 可以使用絕對路徑 `/Users/hermes/.local/bin/wiki`；一般開源使用者只需要確保 `wiki` 在自己的 `PATH` 中。

## Development

```zsh
npm test
npm pack --dry-run
spectra validate open-source-file-structure
```

檔案架構與 publish 邊界見 `docs/open-source-file-structure.md`。
