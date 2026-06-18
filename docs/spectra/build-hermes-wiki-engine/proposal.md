## Why

目前 Joplin-llm-wiki 已經驗證了本機筆記同步、編譯、知識圖譜與 workflow note guardrail，但它主要是 CLI / Codex 操作導向。使用者想讓 Hermes 背景穩定完成知識庫更新，並讓 Hermes 把 Joplin 全筆記庫當成本機長期記憶，同時把 Telegram 對話與 Discord 個人伺服器內容經人工確認後沉澱回 Joplin。

這需要一個重新設計給 Hermes 使用的本機 `wiki` 引擎，而不是把既有 Meeting Agent runtime 或 Joplin-llm-wiki repo 直接混在一起。

## What Changes

- 建立 `hermes-wiki-engine` 的規格與第一版實作邊界。
- 定義 `wiki` command bridge：`status`、`sync`、`compile`、`query`、`draft`、`approve`。
- 定義 Joplin Data API 為跨 macOS 使用者讀寫 Joplin 的唯一整合邊界。
- 定義 Hermes retrieval memory：Hermes 查詢已完成 cache / graph / index，回答必須附來源。
- 定義 Telegram / Discord capture：先產生 filesystem draft，人工 approve 後才寫回 Joplin。
- 定義第一個 apply slice：搬到 `/Users/caiyijun/project/hermes-wiki-engine`，實作 `wiki status`、`wiki sync`、Joplin Data API preflight、raw metadata cache、lock file 與 `status.json`。
- 在同一個 change 內分期規劃 retrieval 主線：raw body cache、thin compile、thin query，先用 Node stdlib 與本機 JSON / Markdown 檔案，不新增 retrieval dependency。

## Capabilities

### New Capabilities

- `hermes-wiki-engine`: Hermes 的本機長期記憶引擎，負責 Joplin 全庫同步、wiki 編譯、graph / index 更新、來源引用查詢，以及 Telegram / Discord draft 沉澱流程。

### Modified Capabilities

(none)

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - New: hermes-wiki-engine/README.md, hermes-wiki-engine/docs/design.md, hermes-wiki-engine/package.json, hermes-wiki-engine/src/wiki.js, hermes-wiki-engine/test/wiki.test.js, hermes-wiki-engine/packaging/hermes/skills/wiki/SKILL.md, openspec/changes/build-hermes-wiki-engine/proposal.md, openspec/changes/build-hermes-wiki-engine/design.md, openspec/changes/build-hermes-wiki-engine/tasks.md, openspec/changes/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - Modified: none
  - Removed: none
