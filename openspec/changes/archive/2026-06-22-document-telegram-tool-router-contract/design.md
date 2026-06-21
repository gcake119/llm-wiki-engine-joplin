## Context

Hermes Wiki Engine 是本機 `wiki` CLI engine，不持有 Telegram bot token，也不負責 Telegram polling。Meeting Agent gateway、Hermes gateway，或其他外部 Telegram adapter 才是訊息 transport 與一般聊天 fallback 的擁有者。

這個 change 只把既有整合邊界寫成專案內 contract：當 Telegram 訊息明確進入 `/wiki` 或 `wiki` route 時，adapter 必須呼叫本機 `wiki` command bridge，並把 stdout 當成工具結果回覆。這可以避免 adapter 把工具輸出再交給 LLM 重寫，導致無證據的 Joplin writeback、draft id、note id 或路徑宣稱。

## Mature Domain

這屬於成熟的 agent tool routing 與 command bridge integration 問題。常見做法是把 tool route、tool execution、stdout handoff、fallback ownership 分成明確邊界：

- Tool route：以 deterministic prefix 或 command grammar 判斷是否進入工具。
- Tool execution：呼叫受控的 local CLI 或 tool API。
- Tool output：直接呈現工具輸出，最多做 transport-level chunking。
- Fallback：只有非工具訊息才交給一般 LLM chat path。

Hermes Wiki Engine 採用這個主流分層，不在 engine 內新增 Telegram polling service，也不要求 engine 知道外部 gateway 的一般聊天策略。

## Contract

### `/wiki` and `wiki` routes

外部 Telegram adapter 收到 `/wiki status`、`wiki query "..."` 等明確 wiki route 時，必須把 route body 轉成 local `wiki` CLI arguments。這類訊息不得進入 Hermes LLM fallback，也不得由 LLM 判斷工具是否成功。

### stdout handoff

`wiki` stdout 是 adapter-safe handoff surface。Telegram adapter 可以因 transport 限制做訊息切段，但不得新增 inferred facts、Joplin writeback claim、draft id、note id、filesystem path，或把 `wiki sedimentation reply --message-only` 的 proof-gated wording 改寫成更強的成功語氣。

### Ownership boundary

Wiki Engine 不啟動 Telegram polling，也不競爭 shared bot token。一般聊天、Meeting Agent route、Hermes fallback、錯誤提示格式與 bot process lifecycle 屬於外部 gateway；Wiki Engine 只提供 deterministic CLI behavior 與可驗證的 stdout contract。

## Non-Goals

- 不修改 `/Users/hermes/.hermes/hermes-agent` live runtime。
- 不在 wiki-engine 新增 Telegram SDK、bot token、polling loop 或常駐 service。
- 不改變 `wiki approve` 才能寫回 Joplin 的治理邊界。
- 不讓 LLM 參與 wiki command success interpretation。

## Verification

- `spectra validate document-telegram-tool-router-contract`
- `spectra analyze document-telegram-tool-router-contract --json`
- README content review：確認 `/wiki`／`wiki` route、stdout unchanged handoff、external gateway ownership 都已記錄。
