## Why

目前 Hermes Wiki Engine 已具備安全的 CLI proof gate 與 review-gated draft 能力，但 Telegram／Hermes 對話層仍把自然語言意圖、reply context、工具狀態宣告與成功訊息混在 runtime adapter 內處理，導致模型幻覺、錯誤路由，以及 live gateway 熱修難以穩定。

這屬於成熟的 agent tool orchestration／conversation state machine 問題。主流做法不是讓 LLM 或 skill 自行宣稱狀態，而是把意圖分類、上下文解析、工具 proof、fail-closed 回覆收斂到可測的 orchestrator；LLM 只負責理解與整理內容，系統負責狀態、路由、證據與寫入邊界。

## What Changes

- 新增 `wiki assistant route` CLI orchestration surface，讓 Telegram、Hermes shell、Discord 等 adapter 可把 normalized conversation event 交給 engine 判斷下一步。
- Orchestrator 會根據自然語言、`reply_to_id`、inline body、draft id 與 tool proof 產生 deterministic action plan 或 user-facing fail-closed message。
- Reply-context sedimentation 只能輸出 `message_resolve_required`／`capture_ready` 等 proof-aware action，或在 resolve proof 缺失時 fail closed；不得使用 Telegram `reply_to_text` preview 建草稿。
- Draft review request 會路由到 `wiki draft show <draft-id> --message-only`，而不是讓模型搜尋任意 filesystem path。
- Orchestrator 回覆成功狀態時必須依 `wiki sedimentation reply` contract，不得讓模型自行宣稱「已存入長期記憶」或「已寫入 Joplin」。
- 補測試與文件，讓 live gateway 未來只需呼叫 orchestrator，不再把 LLM-wiki 核心邏輯散落在 live Python patch。

## Non-Goals

- 不在本 change 內直接修改 `/Users/hermes/.hermes/hermes-agent` live gateway。
- 不新增常駐服務、外部 dependency、vector DB、雲端 LLM 或 Telegram SDK dependency。
- 不改變 `wiki approve` 是唯一 Joplin writeback gate 的治理模型。
- 不讓 orchestrator 直接自動 approve 或直接寫回 Joplin。
- 不把 Telegram `reply_to_text`、UI preview、log snippet 或模型摘要視為完整原文來源。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 新增 engine-owned assistant orchestration contract，讓自然語言知識庫操作先經 deterministic routing、proof gate 與 fail-closed 狀態回覆，再由外部 adapter 執行具體 CLI action。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - Modified: `src/wiki.js`
  - Modified: `test/wiki.test.js`
  - Modified: `README.md`
  - Modified: `docs/design.md`
  - Modified: `packaging/hermes/skills/wiki/SKILL.md`
  - New: none
  - Removed: none
