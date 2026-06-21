## Context

Hermes Wiki Engine 已經具備 `wiki capture`、`wiki message store`、`wiki message resolve`、`wiki draft show` 與 `wiki sedimentation reply` 等 proof-gated CLI surface。這些能力在 CLI smoke 中可成立，但 live Telegram／Hermes gateway 仍把自然語言意圖判斷、reply context 解析、工具呼叫與成功訊息散落在 runtime adapter 內，造成錯誤路由與模型幻覺難以測試。

這個問題屬於成熟的 agent tool orchestration 與 conversation state machine 領域。常見設計是把「LLM 可自由生成的語言」與「系統必須保證的狀態轉移」分開：LLM 可協助理解內容，但 action selection、proof validation、failure states、writeback boundary 必須由 deterministic orchestrator 管理。

## Goals / Non-Goals

**Goals:**

- 在 engine 內新增 `wiki assistant route --input <path>`，作為自然語言 wiki 操作的 deterministic orchestration entrypoint。
- 讓 adapter 可傳入 normalized conversation event，取得 machine-readable action plan 或 user-facing fail-closed message。
- 將 reply-context sedimentation 固定為 `reply_to_id` proof flow：沒有 resolved full message proof 就不得 capture。
- 將 draft review request 固定為 `draft_show_required` action，而不是讓模型搜尋 filesystem。
- 讓 successful persistence claim 只能根據 `wiki sedimentation reply` proof contract 出現。
- 保持 stdlib-only、foreground CLI-only、可用 `node:test` 驗證。

**Non-Goals:**

- 不修改 live `/Users/hermes/.hermes/hermes-agent` gateway。
- 不實作 Telegram SDK adapter、不啟動 daemon、不新增外部服務。
- 不導入雲端 LLM、embedding、vector DB 或新的 package dependency。
- 不讓 orchestrator 直接 `approve` 或直接寫回 Joplin。
- 不把 `reply_to_text` preview、log snippet、UI summary、模型摘要當成完整 capture body。

## Decisions

### Introduce an engine-owned assistant route command

新增 `wiki assistant route --input <path>`，輸入為 normalized JSON event，輸出為 JSON。這讓 Telegram、Hermes shell、Discord 或未來 UI 都使用同一套 decision contract，而不是各自把自然語言規則寫在 adapter 裡。

替代方案是繼續強化 skill prompt 或 live gateway patch；不採用，因為 prompt 無法保證狀態宣告，live patch 無法可靠測試與版本治理。

### Return action plans instead of executing every side effect

Orchestrator 預設不直接呼叫 capture、draft show 或 approve。它回傳 `action` 與 `commands`，讓 adapter 或下一層 command bridge 執行。這保留可測性，並避免 assistant route 本身在沒有使用者確認時建立 draft。

本 change 的最小實作可支援 optional `--execute` 以便 CLI smoke，但預設路徑必須是 planning-only。若 `--execute` 納入實作，仍只能執行 read-only draft show 或 review-gated capture，不得 approve。

### Treat reply_to_text as preview-only metadata

輸入可包含 `reply_to_text` 方便 UI 顯示與 debug，但 orchestrator 不得把它當成 capture content。只要使用者意圖是 reply-context sedimentation，唯一可 capture 的 body 來源是 `resolved_event.text`，也就是上游已由 `wiki message resolve` 取得的完整事件。

### Keep inline body capture explicit

若沒有 `reply_to_id`，只有在同一則訊息包含冒號、換行或等價 delimiter 後的實質正文時，orchestrator 才可輸出 `capture_required`。Command-only 文字必須回 fail-closed message，要求使用者回覆目標訊息、貼完整正文或提供 draft id。

### Keep proof messages centralized

Orchestrator 可以要求 adapter 將 capture／approve JSON pipe 到 `wiki sedimentation reply --message-only`。它本身不得生成更強的成功語氣；success wording 仍由既有 sedimentation reply proof formatter 管理。

## Implementation Contract

Behavior:

- `wiki assistant route --input <path>` 讀取 normalized event JSON 並輸出 pretty JSON。
- 當事件是 Telegram／Hermes wiki 沉澱意圖且含 `reply_to_id`，但沒有 `resolved_event` 或 `resolved_event.text` 時，輸出 `ok: false`、`state: "failed_closed"`、`code: "ASSISTANT_REPLY_TARGET_UNRESOLVED"`，message 要求使用者提供完整原文；不得輸出 capture command。
- 當事件是沉澱意圖且含 `reply_to_id` 與完整 `resolved_event.text` 時，輸出 `ok: true`、`state: "action_required"`、`action: "capture_from_resolved_message"`，並提供 capture-compatible event payload；payload text 必須等於 `resolved_event.text`，不得等於 user instruction 或 `reply_to_text`。
- 當事件是 command-only sedimentation request，輸出 fail-closed `ASSISTANT_CAPTURE_TARGET_REQUIRED`，不得建立 draft 或輸出 capture payload。
- 當事件包含 inline body，例如「整理成待審草稿：<正文>」，輸出 `action: "capture_inline_body"` 與 capture-compatible event payload，payload text 必須是 delimiter 後的正文。
- 當事件要求「給我看 draft-... 的全文」或等價審閱語句，輸出 `action: "show_draft"` 與 `commands`，命令必須是 `wiki draft show <draft-id> --message-only`，不得要求搜尋 filesystem path。
- 當事件不屬於 wiki assistant 可判斷意圖，輸出 `ok: true`、`state: "no_action"`，讓 adapter 繼續走一般 LLM 對話。

Interface / data shape:

- Command: `wiki assistant route --input <path>`
- Input JSON shape:
  - `platform`: string such as `telegram`、`hermes`、`discord`
  - `source_id`: chat/channel/session id
  - `message_id`: inbound message id
  - `author_handle`: optional display/source label
  - `timestamp`: optional ISO timestamp
  - `text`: user message text
  - `reply_to_id`: optional replied message id
  - `reply_to_text`: optional preview only, never authoritative
  - `resolved_event`: optional full event returned by `wiki message resolve`
- Output JSON shape:
  - `ok`: boolean
  - `state`: `no_action`、`action_required`、or `failed_closed`
  - `action`: optional action name
  - `message`: user-facing safe message
  - `commands`: optional array of command arrays such as `["wiki", "draft", "show", "draft-...", "--message-only"]`
  - `capture_input`: optional object `{ "events": [...] }`
  - `proof`: optional refs such as `reply_to_id` and `source_id`

Failure modes:

- Missing input file returns `ASSISTANT_INPUT_MISSING`.
- Invalid JSON returns `ASSISTANT_INPUT_INVALID`.
- Sedimentation reply target missing returns `ASSISTANT_REPLY_TARGET_UNRESOLVED` or `ASSISTANT_CAPTURE_TARGET_REQUIRED`.
- Unsafe draft id returns `ASSISTANT_DRAFT_ID_INVALID`.
- Failure messages must not include stack traces, env values, raw tokens, or filesystem internals.

Acceptance criteria:

- `node --test test/wiki.test.js` covers command-only sedimentation fail-closed, unresolved reply fail-closed, resolved reply capture payload, inline body capture payload, draft show routing, and no-action pass-through.
- `spectra validate add-wiki-assistant-orchestrator` passes.
- `spectra analyze add-wiki-assistant-orchestrator --json` has no Critical or Warning findings.

Scope boundaries:

- In scope: CLI parser branch, orchestrator helper function, tests, README/design/skill guidance.
- Out of scope: live gateway patching, LaunchDaemon changes, direct Joplin writeback, direct Telegram API calls, LLM generation, external dependencies.

## Risks / Trade-offs

- [Risk] Adapter still ignores the orchestrator and keeps bespoke routing → Mitigation: document adapter contract and add examples that make the orchestrator the only supported natural-language wiki routing path.
- [Risk] Planning-only output adds one extra step for adapter authors → Mitigation: output command arrays and capture payloads so adapters can execute without reinterpreting intent.
- [Risk] Inline body parsing can still misclassify casual text → Mitigation: only accept explicit delimiter body; command-only remains fail-closed.
- [Risk] Existing live gateway hotfix drifts from repo → Mitigation: this change moves future work into repo-tested CLI behavior; live runtime can later call the command instead of hosting orchestration logic.
