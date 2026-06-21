## Context

前一個 change 已新增 `formatSedimentationReply()` 與 Hermes skill guidance，但 live Telegram bot 仍在沒有 `draft_id`／`joplin_note_id` 的情況下宣稱已寫入長期筆記庫。實測確認 wiki package 與 skill 已部署，問題是外部對話層沒有被迫使用 proof-gated formatter。

這次修正把 formatter 提升為 CLI command bridge。Telegram gateway 或 Hermes runtime 可以把上一個工具結果 pipe 進 `wiki sedimentation reply`，拿到 deterministic JSON，再把其中 `message` 回給使用者。這符合 agent tool-calling guardrail 的成熟做法：成功狀態由工具輸出與 proof fields 決定，不由模型自由宣稱。

## Goals / Non-Goals

**Goals:**

- 提供 live runtime 可直接呼叫的 `wiki sedimentation reply` 命令。
- 支援 stdin tool result，避免外部 runtime import pnpm global source path。
- 對空輸入、invalid JSON、失敗結果與 missing proof fields fail closed。
- 更新 skill/docs，要求 Telegram／Hermes 沉澱回覆走此 guard 或等效 proof gate。
- 提供 message-only 模式，讓 Telegram gateway 可以直接把 stdout 當成 outgoing message，不需要自行解析 JSON 或重新生成成功語氣。
- 提供 local message-store CLI bridge，讓 gateway 可先儲存每則 inbound user message 與 outbound bot response，再用 `reply_to_id` resolve 完整原訊息後才交給 `wiki capture`。

**Non-Goals:**

- 不實作 Telegram bot adapter 或 Hermes gateway runtime 的 transport layer。
- 不替使用者建立 draft、不 approve、不寫回 Joplin。
- `wiki sedimentation reply` 仍不呼叫 Joplin Data API、不讀寫 `WIKI_STATE_DIR`；message-store bridge 只寫 local message-store artifacts。
- 不新增 dependency 或 background service。

## Decisions

### Expose sedimentation reply as a CLI guard

新增 `wiki sedimentation reply`，讓外部 runtime 用 command bridge 套用 proof gate。相比要求 gateway import `src/wiki.js`，CLI guard 比較穩定，符合現有 Hermes runtime 的 `/Users/hermes/.local/bin/wiki` 整合方式，也避免 pnpm global store path 變動造成 import 失效。

替代方案是只更新 prompt 或 skill，但實測已證明 prompt-only 不足以阻止錯誤成功宣告，因此不採用。

### Read tool result from stdin by default

`wiki sedimentation reply` 預設讀 stdin。這讓 gateway 可以直接串接上一個工具 stdout，例如 draft 或 approve 結果，不需要把 JSON 塞進 shell argument 造成 quoting 風險。

替代方案是只支援 `--json` 參數，但 Telegram／Hermes runtime 需要處理多層引號，容易再次造成空回應或解析錯誤，因此不採用作為主路徑。

### Return JSON instead of plain text

命令輸出完整 JSON：`ok`、`state`、`message`，成功時包含 `draft_id` 或 `joplin_note_id`。外部 runtime 可以安全取 `message` 給使用者，也能根據 `state` 做下一步分支。

替代方案是只輸出 message，但那會讓 gateway 失去可機器判斷的狀態，不利於 fail-closed orchestration。

### Support message-only handoff for chat adapters

新增 `wiki sedimentation reply --message-only` 作為 Telegram／Hermes 對話層的低摩擦出口。預設 JSON 仍是 machine-readable contract；message-only 是接 Telegram bot／Hermes 對話層時的固定 outgoing-message path：`<draft/capture/approve JSON> | wiki sedimentation reply --message-only`，stdout 必須直接回 Telegram／Hermes，且等於 proof-gated `message`。adapter 不得讓模型重新生成、補寫或翻譯成功語氣，也不得改寫成「已成功存入長期筆記庫」。

替代方案是要求所有 adapter 使用 `jq -r .message`，但 Hermes runtime 不應依賴額外工具，而且多一道 shell parsing 會增加空輸入或錯誤 fallback 的機會。

### Keep user language natural

使用者不應被要求說出 command、JSON pipe、絕對路徑或 proof-gate 細節。當使用者說「這段值得沉澱」、「整理成待審草稿」、「等我確認後再寫入 Joplin」或等價自然語句時，Telegram／Hermes 對話層必須自動判斷為 review-gated draft intent，並由 runtime 路由到 `wiki draft` 或 `wiki capture`。這是 conversational adapter 的責任，不是使用者的提示詞負擔。

### Store then resolve reply targets

Telegram Bot API 不能可靠地用 `chat_id + message_id` 任意回查舊訊息全文，因此 gateway 必須在 inbound user message 進入時先保存完整 normalized event。當 gateway 送出 outbound bot response 後，也必須使用 Telegram 回傳的 sent `message_id` 保存完整 response text，因為使用者最常見的自然語境是回覆機器人的回答說「這段值得沉澱」。`wiki message store telegram --input <path>` 是這個本地 message store 的 CLI bridge；`wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>` 是 reply-context sedimentation 的 deterministic resolver。resolve 成功後才把 returned event 包成 capture input；resolve 失敗、空文字或找不到舊訊息時維持 fail-closed，不 fallback 到 `reply_to_text`。

### Bound message-store retention

Message store 是 resolver cache，不是長期知識庫。預設 `WIKI_MESSAGE_STORE_TTL_DAYS=14`，gateway 可在啟動或每日 maintenance 呼叫 `wiki message prune telegram`，而 `wiki message store` 也會 opportunistically prune 過期 resolver cache。單則訊息預設 `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES=131072`；超過上限時拒絕保存並記錄 `MESSAGE_TEXT_TOO_LARGE`，不截斷文字，避免未來建立不完整草稿。

## Implementation Contract

Observable behavior:

- `wiki sedimentation reply` 從 stdin 讀取工具結果 JSON，輸出 proof-gated reply JSON。
- draft success input `{"ok":true,"state":"drafted","draft_id":"draft-test"}` 會輸出 `state: "draft_created"`，message 包含 `draft-test` 與尚未寫入 Joplin。
- capture success input `{"ok":true,"state":"capture_ingested","accepted":1,"drafts":[{"draft_id":"draft-telegram-test"}]}` 會輸出 `state: "draft_created"`，message 包含 `draft-telegram-test` 與尚未寫入 Joplin。
- approve success input `{"ok":true,"state":"approved","joplin_note_id":"note-abc"}` 會輸出 `state: "approved"`，message 包含 `note-abc` 與已寫入 Joplin。
- empty stdin、invalid JSON、`ok:false`、missing `draft_id`、capture `accepted: 0`、capture missing `drafts[0].draft_id`、missing `joplin_note_id` 會輸出 `state: "failed"`，message 表示無法確認，且不得包含 runtime fallback diagnostics 或成功語氣。
- `wiki sedimentation reply --suggested` 會輸出 `state: "suggested"`，只能說適合建立待審草稿，不得宣稱已保存。
- `wiki sedimentation reply --message-only` 會輸出同一個 proof-gated result 的 `message` 字串，不輸出 JSON wrapper。
- `wiki sedimentation reply --suggested --message-only` 會輸出 suggested result 的 `message` 字串。
- `wiki draft show <draft-id>` 會從 `drafts/<draft-id>.json` 讀取待審草稿，輸出 `state: "draft_loaded"`、`draft_id`、`status`、`content`、provenance 與 intended target。
- `wiki draft show <draft-id> --message-only` 只會輸出草稿 `content`，讓 Telegram／Hermes 可直接貼全文給使用者審閱。
- unknown 或 unsafe draft id 會回 `DRAFT_NOT_FOUND`，message-only 模式回錯誤訊息；chat adapter 不得改為搜尋任意 `/Users/hermes` 路徑或猜測檔案位置。
- `wiki message store telegram --input <path>` 會把 normalized inbound user message events and outbound bot response events 寫入 local message store，keyed by `source_id` and `message_id`，並回 `state: "messages_stored"`、accepted/rejected counts 與 run evidence path。
- `wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>` 會從 local message store 讀出完整原訊息，回 `state: "message_resolved"` 與 capture-compatible `event`。
- `wiki message resolve` 找不到 target 時回 `MESSAGE_NOT_FOUND`，stored text 為空時回 `MESSAGE_TEXT_EMPTY`；gateway 必須把這些結果視為 fail-closed，不得改用 `reply_to_text` preview。
- `wiki message store` rejects entries larger than `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES` with `MESSAGE_TEXT_TOO_LARGE`.
- `wiki message prune [telegram|discord]` removes expired resolver cache entries older than `WIKI_MESSAGE_STORE_TTL_DAYS` and does not remove drafts, review evidence, capture runs, compiled artifacts, or Joplin notes.
- `wiki message resolve` returns `MESSAGE_EXPIRED` for expired entries that have not been pruned yet.
- Natural-language sedimentation requests do not need command names, JSON pipe syntax, absolute paths, or proof-gate details; the Telegram／Hermes chat layer maps them to the review-gated draft flow.
- Natural-language sedimentation requests sent as Telegram replies resolve `reply_to_id` through the Hermes session/message store or Telegram message cache, then use the full stored original message as capture content. The user's message is routing intent only. `reply_to_text` is display preview only and is not authoritative. Preview text, log-truncated snippets, UI summaries, or obviously cut-off reply text are not valid capture content; the adapter must ask for the complete target message, pasted content, or `draft_id`. Without `reply_to_id` or a full stored original message, the adapter may capture inline content from the same message only when substantive body text is present. Command-only messages must ask for a target message, pasted content, or `draft_id`, and must not create a draft from the instruction text.
- Reply-context capture remains fail-closed until the gateway has a verified `reply_to_id -> full stored original message` resolver. Re-enabling capture requires a runtime test proving the resulting draft content equals the full original message, not a preview, log snippet, UI summary, or routing command text.
- Telegram capture allowlist values must be exported into the environment visible to the `wiki` child process. A sourced env file must use `export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=<source-id>`; a bare assignment can leave `process.env.WIKI_CAPTURE_TELEGRAM_ALLOWLIST` empty and make `wiki capture telegram` return `CAPTURE_SOURCE_NOT_ALLOWED`.

Interface / data shape:

- Command: `wiki sedimentation reply [--suggested] [--message-only]`
- Command: `wiki message store telegram|discord --input <path>`
- Command: `wiki message resolve telegram|discord --source-id <id> --message-id <id>`
- Command: `wiki message prune [telegram|discord]`
- Input: stdin string containing draft／capture／approve result JSON, except `--suggested` which does not require stdin。
- Message store input: normalized JSON file with `events[]` containing `source_id`／`message_id`／`author_handle`／`timestamp`／`text` or `caption`。
- Message resolve output: JSON result whose successful `event` can be wrapped as `{"events":[...]}` and passed to `wiki capture <source> --input <path>`。
- Message store retention config: `WIKI_MESSAGE_STORE_TTL_DAYS` default `14`; `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES` default `131072`。
- Output: pretty JSON from `formatSedimentationReply()`。
- Output with `--message-only`: plain UTF-8 message from `formatSedimentationReply()`。
- Sedimentation reply remains read-only and requires no state dir, token, Joplin API, network, or filesystem artifacts. Message store writes only local message-store artifacts under `WIKI_STATE_DIR` and does not create drafts or write to Joplin.

Acceptance criteria:

- Unit tests cover stdin draft success, approve success, suggested, empty stdin, invalid JSON, and missing proof fields through `run()` or CLI execution.
- Unit tests cover stdin capture success with `capture_ingested`, `accepted > 0`, and `drafts[0].draft_id`, plus capture failure with no accepted draft.
- Unit tests cover `wiki draft show <draft-id>` JSON output, message-only content output, missing draft fail-closed behavior, and unsafe draft id rejection.
- Unit tests cover `wiki message store` storing full inbound user message text, full outbound bot response text, and `wiki message resolve` returning a capture-compatible full event.
- Unit tests cover `wiki message resolve` fail-closed behavior for missing reply targets and empty stored text.
- Unit tests cover `wiki message store` rejecting oversized resolver cache entries with `MESSAGE_TEXT_TOO_LARGE`.
- Unit tests cover `wiki message prune` removing expired resolver cache entries without affecting draft or capture semantics.
- Unit tests cover message-only draft success and empty stdin fail-closed output.
- README and Hermes skill document the command, capture proof contract, draft review command, and exported Telegram allowlist requirement, and tell Telegram／Hermes runtime to use deterministic command bridges before user-facing sedimentation success or review replies.
- README and Hermes skill document the `wiki message store`／`wiki message resolve` bridge for inbound user messages and outbound bot responses, and require resolve success before reply-context capture.
- README and Hermes skill document message-store retention defaults, `WIKI_MESSAGE_STORE_TTL_DAYS`, `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES`, and `wiki message prune`.
- README and Hermes skill document that natural-language sedimentation resolves `reply_to_id` to the full original message, treats `reply_to_text` as preview only, keeps reply-context capture fail-closed until the resolver is verified, rejects preview or log-truncated snippets, and that command-only sedimentation requests must ask for a target instead of creating a draft from the instruction.
- README and Hermes skill document that users can ask naturally and must not be required to specify tool routing details.
- `node --test test/wiki.test.js` passes.
- `spectra validate add-sedimentation-reply-command` passes.

Scope boundaries:

- In scope: CLI command, parser support, local message-store bridge, tests, README, design, Hermes skill guidance。
- Out of scope: external gateway code, Telegram transport, Joplin writeback semantics, draft creation semantics。

## Risks / Trade-offs

- [Risk] Gateway still ignores the new command → Mitigation: skill guidance must name the exact command and live verification command, so runtime wiring can be audited.
- [Risk] Stdin parsing creates shell quoting confusion → Mitigation: examples use pipe／printf with stdin, not JSON-in-argument as the main path.
- [Risk] Adding another command expands CLI surface → Mitigation: command is read-only, stdlib-only, and local to an existing safety contract.
