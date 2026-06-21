## Why

實測顯示 live Hermes wiki skill 與 package 已更新，但 Telegram bot 仍能在沒有 `draft_id` 或 `joplin_note_id` 的情況下宣稱「已成功存入長期筆記庫」。目前只有 JS helper 與 skill guidance，外部 Telegram／Hermes gateway 沒有一個穩定 CLI guard 可以直接呼叫來格式化工具結果。

這屬於成熟的 agent tool-calling guardrail 問題。常見做法是把狀態判斷收斂到工具邊界，讓外部對話 runtime 呼叫一個 deterministic command，根據 proof fields 產生可顯示回覆，而不是靠 LLM prompt 自行判斷成功狀態。

## What Changes

- 新增 `wiki sedimentation reply` command bridge，將 draft／capture／approve 工具結果轉成 fail-closed 的 user-facing reply JSON。
- 支援從 stdin 讀取工具結果 JSON，讓 Telegram gateway 可以把上一個工具輸出 pipe 進來格式化。
- 將 `wiki capture telegram`／`wiki capture discord` 的 `capture_ingested` 成功結果納入 proof contract：只有 `accepted > 0` 且 `drafts[0].draft_id` 存在時，才回覆已建立待審草稿。
- 新增 `wiki draft show <draft-id> [--message-only]`，讓 Telegram／Hermes 可以用 draft id deterministic 讀取待審草稿全文，不再讓模型搜尋任意 `/Users/hermes` 路徑。
- 對空輸入、invalid JSON、`ok: false`、缺少 `draft_id`、缺少 `joplin_note_id` 等情境回傳 failed state，不輸出成功語氣。
- 更新 Hermes skill guidance，要求 Telegram／Hermes 沉澱回覆先呼叫 `wiki sedimentation reply` 或等效 guard，再把 message 回給使用者。
- 記錄 live Telegram capture 的運維前提：capture allowlist 必須 export 到 child process environment，例如 `export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=538788141`，否則會被 `CAPTURE_SOURCE_NOT_ALLOWED` 拒絕。
- 補 README 與測試，讓 live runtime 可用 CLI 方式驗證，不需要 import pnpm global source path。

## Non-Goals

- 不在本 change 內修改 Telegram bot transport、Hermes gateway runtime 或外部 service。
- 不自動建立 draft、不自動 approve、不改變 `wiki approve` 寫回 Joplin 的唯一 gate。
- 不讓 `wiki sedimentation reply` 呼叫 Joplin Data API、讀寫 state dir、或改動任何 draft／review artifact。
- 不新增套件或常駐服務。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 新增沉澱回覆 CLI guard，讓外部 Telegram／Hermes runtime 可透過 command bridge 套用 draft-first、approve-gated 回覆契約。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - Modified: `src/wiki.js`
  - Modified: `test/wiki.test.js`
  - Modified: `packaging/hermes/skills/wiki/SKILL.md`
  - Modified: `README.md`
  - Modified: `docs/design.md`
  - New: none
  - Removed: none
