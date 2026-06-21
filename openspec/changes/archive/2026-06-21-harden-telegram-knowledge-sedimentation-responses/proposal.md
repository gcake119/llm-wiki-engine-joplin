## Why

Telegram bot 自然語言對話會讓使用者以為「我會收進筆記庫」等同於已建立草稿或已寫回 Joplin；若工具回空或失敗時仍沿用成功語氣，會破壞 Joplin SSOT 與 review-gated writeback 邊界。

這屬於成熟的 conversational retrieval interface 與 agent tool-calling 狀態契約問題。主流做法是讓聊天層只根據工具結果宣告狀態：未建 draft 不能說已建立，未 approve 不能說已寫入，工具結果不明時必須 fail closed。

## What Changes

- 強化 Hermes／Telegram 對長期知識沉澱的回覆規則：沉澱建議、draft 建立、approve 寫回必須用不同狀態措辭。
- 要求工具空回應、工具失敗、缺少 `draft_id`、缺少 `joplin_note_id` 時不得宣稱已收進筆記庫。
- 要求建立 draft 成功時必須回報 `draft_id` 並明確說尚未寫入 Joplin。
- 要求 approve 成功時必須回報 `joplin_note_id`，才可宣稱已寫回 Joplin。
- 補強 Hermes skill guidance，讓 Telegram bot 或 Hermes gateway 可用同一套 draft-first、approve-gated 回覆契約。

## Non-Goals

- 不在本 change 內實作 Telegram bot adapter、Hermes gateway、或外部 tool-calling runtime。
- 不改變 `wiki approve` 作為唯一 Joplin writeback gate 的治理模型。
- 不允許 agent 自動選永久 target notebook 或自動 approve。
- 不把 LLM 判斷、semantic score、automation summary、pending draft 當成正式長期知識來源。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 強化 Telegram／Hermes 沉澱對話的工具結果狀態契約與 fail-closed 回覆規則。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - Modified: `packaging/hermes/skills/wiki/SKILL.md`
  - Modified: `README.md`
  - Modified: `docs/design.md`
  - Modified: `test/wiki.test.js`
  - Modified: `src/wiki.js`
  - New: none
  - Removed: none
