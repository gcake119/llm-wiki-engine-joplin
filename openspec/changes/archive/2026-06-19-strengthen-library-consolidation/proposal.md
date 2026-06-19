## Summary

補強 Hermes Wiki Engine 的 Joplin 全庫整理能力，讓它從第一版的薄候選與薄 page artifact，前進到可實際支援大型 Joplin 筆記庫的 review-gated knowledge consolidation。

## Motivation

目前缺口集中在三個地方：候選發現只靠標題 grouping、compiled page 只是 note wrapper、approve 前需要人工編輯 draft 才能補 notebook target。這些缺口會讓 Hermes 可以查詢與產生 draft，但很難有效協助整理完整 Joplin 筆記庫。

成熟領域上，這不是要新造 agent framework，而是 local-first knowledge compilation pipeline 與 personal knowledge management backend 的增強：保留 Joplin 作為人類可編輯 SSOT，讓 wiki-engine 產生可審核、可追溯、可回滾的本機 artifact。

## Proposed Solution

- 擴充 full-library candidate discovery，從單一 title topic grouping 改為 deterministic multi-signal scoring：title prefix、notebook parent、markdown links、compiled page sources、recent update clustering，並輸出每個 candidate 的 reasons、score、priority、refs 與 goal。
- 強化 page compilation，將 compiled notes 聚合成 topic/entity style pages，而不是一 note 一 page 的薄 wrapper；每個 page section 必須保留 source note refs，並維持 local-only、model-free、可重建。
- 補上 approve target ergonomics：draft creation 可以接受明確 target notebook，candidate-to-draft 可以保留 proposed target，approve 仍要求 target 存在且只透過 Joplin Data API 寫回。
- 更新 Hermes wiki skill，使 Hermes 在整理完整筆記庫時先產生 bounded candidates，再建立 reviewable draft，最後提醒 operator approve 才能寫回 Joplin。
- 擴充 audit，檢查 candidate、compiled page 與 draft target 的 deterministic governance errors。
- 將尚未自動化的完整知識沉澱能力納入後續規劃：背景排程或 daemon、LLM 摘要與語意去重、embedding/vector/RAG retrieval、自動判斷值得保存、自動 draft-to-compiled-page promotion，以及 Telegram／Discord ingestion bot。這些項目先作為下一輪 change 的設計輸入，不混入本次已完成的 deterministic consolidation 實作。

## Non-Goals

- 不導入 embedding、vector database、RAG service、semantic reranker 或 foreground LLM retrieval。
- 不自動把 consolidation draft 寫回 Joplin；wiki approve 仍是唯一 writeback gate。
- 不讀取 Joplin SQLite 或 profile；所有 Joplin 整合仍只走 Joplin Data API。
- 不做跨使用者多人平台、背景 queue 平台、附件 OCR 或 Telegram／Discord capture 改造。
- 不承諾完全自動判斷哪些知識值得永久保存；本 change 只把候選品質與人工審核效率補足。
- 不在本 change 實作背景排程、daemon、LLM summarization、semantic dedupe、embedding/vector DB、RAG service、自動保存判斷、自動 draft promotion 或完整 Telegram／Discord ingestion bot；這些只被記錄成後續自動化缺口。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- hermes-wiki-engine: 補強全庫整理候選、topic/entity page compilation、draft target 與 audit governance 的規格。

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
