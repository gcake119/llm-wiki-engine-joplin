## Why

Meeting Agent 的 Telegram gateway 已開始用 deterministic tool router 分流 `/ma`、`/meeting-agent`、`/wiki` 與一般 Hermes chat fallback。Wiki Engine 需要在自己的專案內保存這個整合邊界，避免 Telegram adapter 或 Hermes LLM 重新改寫 wiki 工具輸出，造成「已寫入 Joplin」或「已建立草稿」這類無證據幻覺。

## What Changes

- 補充 wiki-engine 對 Telegram tool router 的正式 contract：`/wiki` 與 `wiki` route 只能呼叫本機 `wiki` CLI。
- 明確記錄 stdout/message-only handoff：Telegram adapter 必須直接回傳 `wiki` stdout，不得讓 Hermes LLM 重寫工具結果。
- 更新 README，讓專案文件自己說明 Meeting Agent gateway 如何呼叫 wiki-engine，以及哪些能力仍屬於外部 adapter。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 補充 Telegram router integration 與 stdout-safe wiki command bridge contract。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - Modified: README.md
  - Modified: openspec/specs/hermes-wiki-engine/spec.md
  - New: none
  - Removed: none
