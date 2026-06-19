## Why

目前 Hermes Wiki Engine 已能做 Joplin sync、compile、candidate discovery、source-backed draft、audit 與 approve gate，但仍需要 operator 手動串起流程。若要讓 Hermes 協助完整 Joplin 筆記庫整理與知識沉澱，需要把背景排程、LLM-assisted consolidation、semantic retrieval 與 capture bot 分期納入，同時保留 Joplin SSOT 與 `wiki approve` writeback gate。

使用者進一步確認主要目標是「自動定期整理整個筆記庫」。因此本 change 也要把已完成的一次性 pipeline 延伸成可由 Hermes、launchd 或 cron 定期觸發的 whole-library consolidation loop：定期 sync / compile / candidate / audit，自動產生 bounded review drafts 與通知摘要，但正式 Joplin writeback 仍只能由 `wiki approve` 執行。

這個問題屬於成熟領域：local job scheduling、LLM-assisted knowledge management、semantic search／retrieval、capture ingestion pipeline。設計應優先使用現有 CLI、Node stdlib、本機 artifacts 與 Joplin Data API，不把 repo 擴成通用 agent framework 或多使用者平台。

## What Changes

- 新增 phased automation roadmap，讓自動化沉澱分成 4 個可驗證階段：background pipeline runner、LLM-assisted consolidation、semantic retrieval layer、Telegram／Discord capture bot。
- Phase 1 建立本機自動化 runner：自動執行 `wiki sync`、`wiki compile`、`wiki draft candidates`、`wiki audit`，寫入 run artifact 與通知摘要，但不得 approve 或寫回 Joplin。
- Phase 2 建立 LLM-assisted consolidation：只從 compiled source refs 產生 reviewable draft summary／dedupe recommendation，記錄 model、prompt、source refs、evidence status，預設優先使用 local `ollama call`。
- Phase 3 建立 semantic retrieval layer：從 compiled artifacts 建立可重建 semantic index，foreground answer 仍必須回到 `wiki read`／source refs，不把 semantic score 當事實來源。
- Phase 4 建立 Telegram／Discord capture bot 最小 ingestion：allowlist、rate limit、redaction、failure evidence，輸出 filesystem draft，不直接寫 Joplin。
- Phase 5 建立定期全庫整理 handoff：`wiki automate status` 讓 Hermes 讀取最近 run，定期 runner 可對 top-N candidates 產生 LLM-assisted review drafts，寫入 summary artifact，並透過既有通知管道提醒 operator review／approve。
- 更新 Hermes skill 與 durable design，讓 Hermes 知道哪些流程可自動跑、哪些必須停在 review gate。

## Non-Goals

- 不移除或繞過 `wiki approve`；正式 Joplin writeback 仍只能由 approve 執行。
- 不直接讀寫 Joplin SQLite 或 Joplin profile。
- 不在 foreground `wiki query` 中觸發 sync、compile、LLM、embedding 或 capture jobs。
- 不把 pending draft 當成正式 foreground answer source。
- 不在第一階段引入 queue service、database server、cloud LLM requirement、vector database 或多使用者平台。
- 不自動判斷並直接保存「值得保存」的內容；只能輸出 candidate、recommendation 或 reviewable draft。
- 不在 repo 內建立常駐 scheduler daemon；定期觸發由 Hermes、launchd、cron 或其他外部 runner 負責。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 新增分期自動化沉澱能力，包括背景 pipeline runner、LLM-assisted consolidation、semantic retrieval、capture ingestion、定期全庫整理 handoff，並延續 Joplin SSOT 與 review-gated writeback 規格。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - Modified: src/wiki.js
  - Modified: test/wiki.test.js
  - Modified: docs/design.md
  - Modified: packaging/hermes/skills/wiki/SKILL.md
  - Modified: openspec/specs/hermes-wiki-engine/spec.md
  - New: none
  - Removed: none
