# Hermes Wiki Engine

Hermes Wiki Engine 是搭配 Hermes 使用的 llm-wiki 筆記引擎。它把 Joplin 筆記同步、編譯成可重建的本機 wiki artifacts，讓 Hermes 透過 `wiki` command bridge 查詢、閱讀、追蹤連結，並自動化整理筆記庫內容。

這不是 Joplin 替代品，也不是 hosted RAG service。Joplin 仍是長期知識庫 single source of truth；Hermes 透過 `wiki sync`、`wiki compile`、`wiki query`、`wiki read`、`wiki links` 與 `wiki automate` 操作 source-backed knowledge flow。正式寫回 Joplin 的變更仍需經過 `wiki approve`。

Hermes 之外也能使用：你可以把它當成 standalone Joplin local-first wiki CLI，但需要自己決定由哪個 agent、script 或人工流程呼叫 `wiki`，並負責安排自動化整理的執行時機。

## What It Does

- 從 Joplin Desktop Data API 讀取筆記，建立本機 raw cache。
- 把 raw cache 編譯成可查詢的 wiki pages、graph 與 schema。
- 讓 Hermes 或其他 agent 用 `wiki query`、`wiki read`、`wiki links` 回答 source-backed memory 問題。
- 用 `wiki automate once` 掃描筆記庫、找出整理候選、產生可審核 drafts。
- 只允許 `wiki approve <draft-id>` 正式寫回 Joplin。

## Quickstart

需求：

- Node.js 20 或更新版本。
- pnpm 11 或更新版本。
- Joplin Desktop 開啟 Data API。
- 一組 Joplin Data API token。

安裝：

```zsh
curl -fsSL https://raw.githubusercontent.com/gcake119/llm-wiki-engine-joplin/main/scripts/install.sh | sh
```

安裝腳本會在終端機詢問 `WIKI_STATE_DIR`、`WIKI_JOPLIN_API_URL`、`WIKI_JOPLIN_TOKEN`，並顯示建議值。`WIKI_STATE_DIR` 與 `WIKI_JOPLIN_API_URL` 可以直接按 Enter 採用預設；`WIKI_JOPLIN_TOKEN` 需要貼上 Joplin Data API token。設定會寫入：

```zsh
~/.config/hermes-wiki-engine/env
```

載入後確認 CLI 可用：

```zsh
source ~/.config/hermes-wiki-engine/env
wiki status
```

第一次同步、編譯、查詢：

```zsh
wiki sync
wiki compile
wiki query "問題"
wiki query "問題" --rerank-llm
wiki read <ref>
wiki links <ref>
```

`wiki sync` 只讀 Joplin Data API 並更新 raw cache。`wiki compile` 從本機 raw cache 建立 compiled pages、graph 與 schema。`wiki query`、`wiki read`、`wiki links` 只讀已完成的本機 artifacts，不會在前台查詢時臨時重編全庫。`wiki query "問題" --rerank-llm` 是 optional local LLM reranker：它先用本機 keyword query 取 bounded candidates，再請本機 LLM 重新排序 source refs。LLM rerank 不是答案來源；provider 不可用或輸出無效時會以 `LLM_RERANK_UNAVAILABLE` fail closed，不會假裝結果已 rerank。

## Install Options

預設安裝公開 repo 的 `main`。若要安裝特定 tag：

```zsh
curl -fsSL https://raw.githubusercontent.com/gcake119/llm-wiki-engine-joplin/main/scripts/install.sh | HWE_REF=v0.1.0 sh
```

從 checkout 安裝：

```zsh
pnpm install
pnpm add -g .
cp .env.example .env
```

再編輯 `.env`，至少設定：

```zsh
export WIKI_STATE_DIR="$HOME/.local/state/hermes-wiki-engine"
export WIKI_JOPLIN_API_URL="http://127.0.0.1:41184"
export WIKI_JOPLIN_TOKEN="<your-joplin-data-api-token>"
```

從 checkout 安裝時，載入設定後先確認 CLI 可用：

```zsh
source .env
wiki status
```

## Hermes Usage

Hermes deployment 可以把 `wiki` 裝成固定 command bridge，並在 Hermes skill 內要求長期記憶查詢都走：

```zsh
wiki query "問題"
wiki query "問題" --rerank-llm
wiki read <ref>
wiki links <ref>
```

Hermes 需要更新本機 wiki 時可以呼叫：

```zsh
wiki sync
wiki compile
```

Hermes skill guidance 位於 `packaging/hermes/skills/wiki/SKILL.md`。Hermes 前台回答記憶問題時仍必須使用 compiled source refs；pending draft、semantic score、automation summary 都不是正式事實來源。

### Telegram Sedimentation Replies

Telegram 自然語言對話可以請 Hermes 協助判斷內容是否值得沉澱，但回覆必須依工具結果分層：

- `draft success`：工具回傳 `ok: true`、`state: "drafted"`、`draft_id` 時，只能說已建立待審草稿，並提醒尚未寫入 Joplin。
- `capture success`：`wiki capture telegram`／`wiki capture discord` 回傳 `ok: true`、`state: "capture_ingested"`、`accepted > 0` 且 `drafts[0].draft_id` 時，也只能說已建立待審草稿，並提醒尚未寫入 Joplin。
- `approve success`：`wiki approve` 回傳 `ok: true`、`state: "approved"`、`joplin_note_id` 時，才能說已寫入 Joplin。
- `empty tool failure`：工具空回應、不可解析、`ok: false` 或缺少必要 id 時，必須說無法確認已建立或已寫回，不能沿用成功語氣。

自然語言 wiki 操作的第一步應該是 engine-owned orchestrator，而不是 Telegram adapter 自己猜：

```zsh
wiki assistant route --input <normalized-event.json>
```

`assistant route` 會回 `no_action`、`action_required` 或 `failed_closed`。當它回 `action_required` + `capture_from_resolved_message` 時，adapter 才把 `capture_input` 寫成 JSON 並呼叫 `wiki capture telegram --input <path>`，接著把 capture JSON pipe 到 `wiki sedimentation reply --message-only`。當它回 `action_required` + `capture_inline_body` 時也走同一個 review-gated capture flow。當它回 `action_required` + `show_draft` 時，adapter 只執行 `wiki draft show <draft-id> --message-only` 並直接送 stdout。當它回 `ASSISTANT_REPLY_TARGET_UNRESOLVED` 或 `ASSISTANT_CAPTURE_TARGET_REQUIRED` 時，adapter 必須直接送出該 message，不得讓模型改寫。

使用者不需要說出 command、JSON pipe、路徑或 proof gate 細節。當使用者自然地說「這段值得沉澱」、「整理成待審草稿」、「等我確認後再寫入 Joplin」或類似語句時，Telegram gateway 或 Hermes runtime 必須自動路由到 review-gated draft flow，再用下方 CLI guard 回覆。這類自然語言沉澱要求不得寫入 `/Users/hermes/Drafts`、不得建立 Skill、不得建立 Memory entry，也不得直接宣稱已寫入 Joplin。

自然語言沉澱必須保留對話語境。若使用者是回覆某則 Telegram 訊息並說「這段值得沉澱」或「整理成待審草稿」，chat adapter 必須先用 `reply_to_id` 到 Hermes session／message store 或 Telegram message cache 解析完整原訊息，並以該完整內容作為 capture content；使用者這句指令只代表 routing intent。`reply_to_text` 只能作為顯示用 preview，不得被視為完整內容來源。若 runtime 只能取得 preview、log-truncated snippet、UI 摘要或明顯截斷片段，必須 fail closed，請使用者回覆完整訊息、貼上完整正文，或提供可讀取的 draft id；不得建立部分草稿。若沒有 `reply_to_id`／完整原訊息，但訊息本身在冒號、換行或同則訊息中包含正文，才使用該正文。若訊息只有「這份草稿值得沉澱，幫我整理成待審草稿」這類 command-only 文字，chat adapter 必須請使用者回覆要沉澱的訊息、貼上正文，或提供 draft id，不得只把指令本身建立成草稿。

在 gateway 尚未實作並驗證 `reply_to_id -> full stored original message` 解析之前，reply-context sedimentation 必須保持 fail-closed，不得把 `reply_to_text` preview 送進 `wiki capture`。只有當 runtime 能證明已取得完整原訊息時，才能重新開啟 reply-context capture。

Gateway 取得完整原訊息的方式是先建立本地 message store。每一則 Telegram inbound user message 進入 gateway 時，adapter 應把完整 event 寫成 normalized JSON，呼叫 `wiki message store telegram --input <path>` 儲存 `source_id`、`message_id`、author、timestamp 與完整 `text`。更重要的是，每一則 outbound bot response 送出 Telegram 後，也必須用 Telegram 回傳的 sent `message_id` 和完整 response text 呼叫同一個 `wiki message store telegram --input <path>`。這樣使用者覺得機器人回答值得沉澱並回覆該 bot response 時，`reply_to_id` 才能對應到完整機器人回答。當使用者回覆該訊息要求沉澱時，再用 `wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>` 查回完整 capture event。只有 resolve 回傳 `ok: true`、`state: "message_resolved"` 且 event 內有完整 text 時，才把該 event 包成 `{"events":[...]}` 交給 `wiki capture telegram --input <path>`；`MESSAGE_NOT_FOUND`、`MESSAGE_TEXT_EMPTY` 或任何 resolve failure 都必須 fail-closed，不得 fallback 到 `reply_to_text`。

Message store 只是 `reply_to_id` resolver cache，不是永久知識庫。預設 `WIKI_MESSAGE_STORE_TTL_DAYS=14`，超過保留期的 cache 會在 `wiki message store` 時順手 prune，也可以由 gateway 啟動或每日 cron 呼叫 `wiki message prune telegram` 清理。單則 resolver cache 預設 `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES=131072`；超過上限的訊息會以 `MESSAGE_TEXT_TOO_LARGE` rejection 記錄，不會截斷保存，避免未來沉澱出不完整草稿。若過期訊息尚未被 prune，`wiki message resolve` 會回 `MESSAGE_EXPIRED` 並 fail-closed。清理 message store 不會刪除 `drafts/`、`review/`、`capture/runs/` 或任何 Joplin 筆記；只會影響能否回覆較舊訊息建立新草稿。

Telegram gateway 或 Hermes runtime 可以用 CLI guard 格式化工具結果，不需要 import pnpm global source path：

```zsh
printf '%s' '{"ok":true,"state":"drafted","draft_id":"draft-test"}' | wiki sedimentation reply
printf '%s' '{"ok":true,"state":"capture_ingested","accepted":1,"drafts":[{"draft_id":"draft-telegram-test"}]}' | wiki sedimentation reply
printf '%s' '{"ok":true,"state":"approved","joplin_note_id":"note-abc"}' | wiki sedimentation reply
printf '' | wiki sedimentation reply
wiki sedimentation reply --suggested
```

下一步接 Telegram bot／Hermes 對話層時，固定用 message-only handoff，直接把 stdout 當成 outgoing message：

```zsh
<draft/capture/approve JSON> | wiki sedimentation reply --message-only
printf '%s' '{"ok":true,"state":"drafted","draft_id":"draft-test"}' | wiki sedimentation reply --message-only
printf '%s' '{"ok":true,"state":"capture_ingested","accepted":1,"drafts":[{"draft_id":"draft-telegram-test"}]}' | wiki sedimentation reply --message-only
printf '' | wiki sedimentation reply --message-only
wiki sedimentation reply --suggested --message-only
```

Telegram capture allowlist 必須 export 給 `wiki` 子程序讀取，例如 Hermes runtime source 的 env 檔應包含：

```zsh
export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=538788141
```

只寫 `WIKI_CAPTURE_TELEGRAM_ALLOWLIST=538788141` 只會設定目前 shell 變數，`wiki capture telegram` 讀不到 `process.env.WIKI_CAPTURE_TELEGRAM_ALLOWLIST`，會回 `CAPTURE_SOURCE_NOT_ALLOWED`。

這個 repo 不實作 Telegram bot adapter；Telegram gateway 或 Hermes runtime 應呼叫 `wiki capture telegram`、`wiki draft ...`、`wiki approve ...`，再依上述 proof 回覆使用者。chat adapter 若使用 `--message-only`，必須直接把 stdout 回 Telegram，不得讓模型重寫成「已成功存入長期筆記庫」。

審閱待審草稿時，chat adapter 應把「給我看 draft-... 的全文」或等價自然語句路由到：

```zsh
wiki draft show <draft-id>
wiki draft show <draft-id> --message-only
```

`--message-only` 只輸出草稿 `content`，可以直接回 Telegram／Hermes。找不到草稿或 draft id 不安全時，必須回 fail-closed 訊息，不要讓模型自行搜尋 `/Users/hermes` 或猜測檔案路徑。

## Automated Library Maintenance

`wiki automate once` 會執行一輪 review-gated 筆記庫整理流程：

```zsh
wiki automate once
wiki automate once --draft-top 2 --notify
wiki automate status
```

自動化流程會依序執行 sync、compile、candidate discovery 與 audit。加上 `--draft-top <N>` 時，它最多產生 N 份 LLM-assisted review drafts，方便 operator 後續審核。

自動化不會呼叫 `wiki approve`，不會寫入 Joplin notes，也不會替你永久決定 target notebook。若只想刷新 evidence 與 candidates，省略 `--draft-top` 或使用 `--draft-top 0`。

### macOS LaunchDaemon

Hermes deployment 可以用 repo 內建 helper 把一輪整理流程安裝成 macOS system LaunchDaemon。自動排程是預設值：installer 會預設載入 `com.hermes.wiki-automate`，並以 `hermes` user 每天 03:30 執行 `wiki automate once`：

```zsh
sudo scripts/install-macos-launchdaemon.sh
```

安裝後可以用 deterministic 指令確認 launchd 與 wiki automation 狀態：

```zsh
sudo launchctl print system/com.hermes.wiki-automate
sudo launchctl kickstart -k system/com.hermes.wiki-automate
sudo -iu hermes zsh -lc 'source "$HOME/.config/hermes-knowledge/env" && "$HOME/.local/bin/wiki" automate status'
sudo -iu hermes zsh -lc 'find "$HOME/knowledge/automation/runs" -type f -mtime -1 -print | tail -5'
```

helper 只安裝 `/Users/<user>/bin/wiki-automate-once` 與 `/Library/LaunchDaemons/com.hermes.wiki-automate.plist`。plist 不保存 Joplin token；wrapper 只 source 既有 env file 並執行 `wiki automate once`。如需覆寫 user、label 或時間，可在執行 installer 時設定 `HWE_AUTOMATION_USER`、`HWE_AUTOMATION_LABEL`、`HWE_AUTOMATION_HOUR`、`HWE_AUTOMATION_MINUTE`。如只想產生檔案但暫不載入 launchd，可設定 `HWE_AUTOMATION_LOAD=0`。

## Non-Hermes Usage

這個 CLI 也適合 Hermes 之外的本機使用場景：

- 個人 Joplin 筆記庫的 local-first search／read／link layer。
- 其他 AI agent 的 source-backed memory command bridge。
- cron、launchd、macOS LaunchDaemon helper 或手動 script 觸發的筆記庫整理流程。
- 先產生 reviewable drafts，再由人決定是否 approve 的知識沉澱流程。

它不提供 hosted multi-user service、Joplin sync server、web UI、常駐 daemon runtime 或直接替代 Joplin 的筆記編輯體驗。若你不使用 Hermes，需要自行負責 operator review 與 agent 呼叫規則。

## Commands

```zsh
wiki status
wiki sync
wiki compile
wiki query "問題"
wiki query "問題" --rerank-llm
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
wiki sedimentation reply
wiki sedimentation reply --message-only
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
pnpm test
pnpm pack --dry-run
spectra validate open-source-file-structure
```

檔案架構與 publish 邊界見 `docs/open-source-file-structure.md`。
