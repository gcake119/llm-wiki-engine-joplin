# ADR-0001：Joplin SSOT 與 Review-Gated Writeback

日期：2026-06-19

狀態：採用，歷史回填

產品範圍：hermes-wiki-engine

關聯 Spectra：`openspec/specs/hermes-wiki-engine/spec.md`

關聯 archive：`openspec/changes/archive/2026-06-19-strengthen-library-consolidation/`

關聯 commit：`ab8ee51`

## 背景

Hermes Wiki Engine 需要協助整理大型 Joplin 筆記庫，但不能讓 agent 直接改動人類長期知識庫。`strengthen-library-consolidation` 已把 full-library candidate discovery、grouped source-backed pages、target notebook draft、candidate audit 納入 Spectra spec，並明確保留人工 review gate。

這個決策屬於 local-first knowledge compilation pipeline 與 personal knowledge management backend 的治理邊界。它會反覆影響後續背景排程、LLM 摘要、語意去重、embedding/RAG、Telegram／Discord ingestion bot 與自動保存判斷，因此需要從 Spectra archive 回填到 repo-local decision layer。

## 決策

Joplin 是 Hermes 長期知識庫的 single source of truth。

Hermes Wiki Engine 對 Joplin 的整合只能走 Joplin Data API，不直接讀寫主使用者的 Joplin SQLite、profile 或跨使用者檔案。

`wiki sync` 可以讀取 Joplin 資料並建立本機 raw cache。`wiki compile`、`wiki query`、`wiki read`、`wiki links`、`wiki draft candidates`、`wiki draft candidate`、`wiki draft consolidate`、`wiki draft reject`、`wiki audit` 都只能讀寫本機可重建或 review artifacts，不得建立、更新或刪除 Joplin notes。

`wiki approve <draft-id>` 是唯一 Joplin writeback gate。Approve 前，draft 必須有 provenance、content、target notebook、conflict behavior；缺任何一項都必須 fail closed，且不得呼叫 Joplin writeback。

LLM、embedding、RAG、save-worthiness scoring、Telegram／Discord ingestion bot、背景排程若在後續導入，只能產生 source-backed candidate、recommendation 或 reviewable draft。除非另有新的 ADR 與 Spectra change 明確改變治理模型，這些自動化不得跳過 `wiki approve`。

## 適用範圍

- `src/wiki.js` 的 wiki CLI 行為。
- `packaging/hermes/skills/wiki/SKILL.md` 的 Hermes 操作規則。
- `docs/design.md` 的 runtime boundary 與 deferred automation track。
- `openspec/specs/hermes-wiki-engine/spec.md` 中 Joplin integration、draft、approve、audit、candidate、compile 的需求。
- 後續所有會觸及 Joplin writeback、背景工作、LLM 自動化、capture bot、semantic retrieval 的 Spectra change。

## 不適用範圍

- 不定義 Joplin notebook taxonomy 或筆記命名規則。
- 不要求每一個 local cache artifact 永久保存；raw、compiled、graph、candidate、audit 都可以重建。
- 不禁止 operator 手動在 Joplin 編輯筆記。
- 不在本 ADR 決定是否導入 LLM、embedding、vector DB、RAG service 或 bot runtime；那些需要各自的 Spectra change。

## 取捨

好處是資料權威清楚、跨使用者權限邊界清楚、agent 不會在未審核時污染正式筆記庫，後續自動化也能先從 candidate／draft 層安全落地。

成本是自動化程度較低，整理流程需要人工 approve；LLM 或 bot 即使能產生高品質草稿，也不能直接沉澱到 Joplin。

風險是 review gate 造成 backlog。緩解方式是改善 candidate scoring、audit、target notebook ergonomics、背景排程與通知，而不是移除 approve gate。

## 不採用方案

- 直接讀寫 Joplin SQLite 或 profile：不採用，因為跨 macOS 使用者權限、檔案鎖、profile path 與 Joplin internal schema 都不適合作為外部整合 API。
- Candidate 或 draft 自動寫回 Joplin：不採用，因為會讓 agent 直接污染長期知識庫，且缺少 rollback／review evidence。
- 把 pending consolidation draft 當 foreground answer source：不採用，因為 pending draft 尚未進入 Joplin SSOT，也未經正式 review。
- 一次導入 daemon、LLM pipeline、vector DB 與 bot runtime：不採用，因為會把 job scheduling、LLM governance、semantic search、capture ingestion 多個成熟領域綁成單一高風險變更。

## 後續影響

後續 proposal 若要做背景排程，應只自動串起 `wiki sync`、`wiki compile`、`wiki draft candidates`、`wiki audit`，不得自動 approve。

後續 proposal 若要做 LLM 摘要或語意去重，輸入必須是 compiled source refs，輸出必須保留 provenance，結果只能是 candidate 或 reviewable draft。

後續 proposal 若要做 embedding／RAG，vector index 必須從 compiled artifacts 可重建，foreground answer 必須保留 source refs，不能把 semantic result 本身當事實來源。

後續 proposal 若要做 Telegram／Discord ingestion bot，capture runtime 必須有 allowlist、rate limit、redaction、secret handling 與 failure evidence，且只產生 filesystem draft。

## 驗證方式

- `spectra validate`
- `npm test`
- 檢查 `openspec/specs/hermes-wiki-engine/spec.md` 中 `Approve remains the only writeback gate` 與 `Audit remains local only` 相關 scenarios。
- 檢查 `packaging/hermes/skills/wiki/SKILL.md` 是否仍要求 candidate discovery、draft、audit 不得宣稱已寫入 Joplin，正式寫回只能經 `wiki approve`。
