## Context

Hermes Wiki Engine 目前已完成 Joplin raw sync、本機 compiled notes、source-backed pages、minimal graph、query/read/links/audit、draft/approve gate。這讓 Hermes 可以把 Joplin 全筆記庫當成本機記憶來源查詢，但目前 compiled page 幾乎只是 source note mirror，缺少 Karpathy LLM Wiki 模式中較關鍵的三件事：schema-guided compilation、跨筆記 consolidation、以及治理循環。

這個問題屬於成熟領域：personal knowledge management backend、agent memory ingestion pipeline、local-first retrieval layer。主流架構通常拆成 raw source、compiled representation、retrieval interface、review gate、audit/governance。這個 repo 已經有前四層的最小版本，本設計只補第 2 層與第 5 層，不新增服務平台或向量檢索系統。

現有不可破壞的邊界：Joplin 是長期知識庫 SSOT；Joplin 整合只能走 Data API；Hermes 前台查詢只能讀已完成的本機 artifacts；Telegram、Discord、feedback、consolidation 內容都必須先成為 filesystem draft，人工 approve 後才可以寫回 Joplin。

## Goals / Non-Goals

**Goals:**

- 讓 wiki compile 寫出本機 schema artifact，明確描述 compiled wiki page、source refs、draft kinds、governance rules。
- 讓 wiki draft consolidate 能從本機 read artifacts 與指定 refs 產生 reviewable consolidation draft，草稿必須保留來源 refs 與 intended target。
- 讓 wiki audit 能覆蓋 consolidation 產生的治理問題，包括 stale source、missing source、evidence gap、draft without target。
- 讓 Hermes skill 文件知道 consolidation 是背景整理流程，foreground memory answer 仍必須走 query/read/links 並檢查 evidence_status。
- 保持所有新資料結構是可重建、可檢查、可用 node:test 驗證的本機 JSON 或 Markdown。

**Non-Goals:**

- 不加入 vector database、embedding pipeline、RAG service、常駐 daemon、queue 平台或新套件。
- 不在 wiki query、wiki read、wiki links 呼叫 LLM、Joplin Data API、embedding service 或外部 retrieval API。
- 不讓 wiki compile 或 wiki draft consolidate 自動寫回 Joplin。
- 不支援附件 OCR、圖片理解、Joplin resource 全量同步、note history merge。
- 不實作全自動價值判斷；consolidation 只整理被指定或本機 artifacts 可追溯的內容，最終沉澱仍由 approve gate 控制。

## Decisions

### Keep consolidation as a reviewable draft path

wiki draft consolidate 將延伸現有 draft 機制，而不是新增 writeback command。輸入以現有 CLI rest args 為主：可接受一個或多個 ref，例如 note:note-a 或 page:page-local-retrieval，也可接受 operator 提供的整理文字。輸出仍是 drafts/<draft-id>.json，但 kind 為 consolidate，status 為 pending_review，provenance.refs 保留所有輸入 refs，intended_target.type 為 joplin_inbox，conflict_behavior 為 manual_review。

選擇這個做法，是因為它沿用已測過的 draft/approve 邊界，避免讓整理流程擁有直接寫入 Joplin 的能力。替代方案是新增 wiki consolidate 並直接產生 compiled pages；這會讓未審核內容進入 read path，先不採用。

### Write a local wiki schema artifact during compile

wiki compile 需要寫出 compiled/schema.json，內容包含 schema_version、page_model、ref_kinds、draft_kinds、governance_rules。schema 不需要抽象成外部 DSL；第一版只需要 JSON，讓 Hermes 和後續 agent 能讀懂 artifact contract。

選擇 JSON 是因為 repo 目前所有 runtime artifacts 都是 JSON/Markdown，Node stdlib 足夠處理。替代方案是引入 YAML schema 或 plugin registry；目前沒有必要，會增加 parser 與 validation 面。

### Keep compiled pages source-backed and deterministic

compile 仍不呼叫 LLM。現階段 source-backed page 可以維持 deterministic 結構，但 schema 必須允許 page.sources 和 section.sources 由多個 source refs 支撐。若要產生跨筆記主題頁，先透過 consolidation draft 進 review，再由 approve 寫回 Joplin；下一輪 sync/compile 後自然進入正式 read path。

這是故意慢一拍的 sedimentation：整理結果先成為可審核 draft，不直接污染 compiled artifacts。替代方案是 compile 時自動合併相似 notes；這需要語意判斷與衝突解決，超出本次最小落差修補。

### Extend audit as local governance rather than semantic grading

wiki audit 只做 deterministic governance checks：source refs 是否存在、draft 是否缺 target、page section 是否缺 sources、graph/page 是否有 dangling links。它不判斷內容正確性、不做 LLM confidence、不自動刪改資料。

選擇這個邊界，是因為目前 repo 已明確禁止 read path model-dependent retrieval。替代方案是讓 audit 呼叫 LLM 找矛盾；這屬於後續 semantic audit change，必須另開 proposal。

### Update Hermes skill as the operator contract

packaging/hermes/skills/wiki/SKILL.md 必須補上：整理知識時用 wiki draft consolidate，沉澱到 Joplin 時仍用 wiki approve；回答記憶問題時不得用 draft 取代 evidence-backed read path。

這讓 Hermes 的操作規則跟 runtime 行為一致。替代方案是只改 CLI、不改 skill；那會讓 Hermes agent 不知道新能力，容易繼續把 consolidation 當成聊天中的自由文字整理。

## Implementation Contract

**Behavior:**

- wiki compile 成功後，除了既有 compiled notes、pages、graph、status，也會寫 compiled/schema.json。schema 必須能讓讀者知道 ref kind、page model、draft kind、governance rule 名稱。
- wiki draft consolidate 接受本機 refs 與整理內容，產生 pending_review filesystem draft。它不讀 Joplin Data API、不寫 compiled artifacts、不寫 graph、不寫 audit、不寫 Joplin。
- wiki audit 會讀 local artifacts 與 drafts，將 deterministic governance errors 寫入 audit/error-book.json，並在 command output 回傳 total_errors 與 kind_counts。
- wiki approve 維持唯一 Joplin writeback 入口，只有完整 draft metadata 與 target notebook 時才 POST notes。
- Hermes skill 文件會把 consolidation 說成 reviewable background capture flow，不把它當成 foreground answer source。

**Interface / data shape:**

- compiled/schema.json：包含 schema_version，ref_kinds，draft_kinds，page_model，governance_rules。
- consolidate draft：沿用 drafts/<draft-id>.json，kind 為 consolidate，status 為 pending_review，content 為整理內容，provenance.source 為 consolidate，provenance.refs 為輸入 refs，intended_target.conflict_behavior 為 manual_review。
- audit/error-book.json：entries 的 kind 至少可包含 missing_source、evidence_gap、dangling_link、draft_target_missing。
- command output：wiki draft consolidate 成功回傳 ok: true、state: drafted、draft_id、kind、path；wiki audit 成功回傳 ok: true、state: audited、total_errors、kind_counts。

**Failure modes:**

- consolidate 沒有內容時回傳 DRAFT_CONTENT_MISSING。
- consolidate 提供 unsafe ref id 時回傳 user-safe error，不能寫出 draft。
- audit 遇到缺少 optional artifacts 時不崩潰；只對存在的 local artifacts 做檢查。
- 所有錯誤輸出不得包含 token、webhook URL、raw stack trace。

**Acceptance criteria:**

- node --test 覆蓋 schema artifact、consolidation draft、approve gate 不變、audit governance error。
- spectra validate close-llm-wiki-architecture-gap 通過。
- 手動執行 wiki compile 後可以看到 compiled/schema.json；執行 wiki draft consolidate --ref note:note-a 文字內容後可以看到 drafts/<draft-id>.json，且 Joplin mock 沒有被呼叫。

**Scope boundaries:**

- In scope：src/wiki.js、test/wiki.test.js、docs/design.md、packaging/hermes/skills/wiki/SKILL.md。
- Out of scope：新增 npm dependency、背景 daemon、LaunchDaemon、semantic LLM audit、embedding/vector retrieval、附件 OCR、Joplin resource sync、改變 Joplin SSOT 邊界。

## Risks / Trade-offs

- [Risk] consolidation 先走 draft 會比自動寫入慢。→ Mitigation：這是保護 Joplin SSOT 的刻意設計；需要大量批次整理時再規劃批次 approve。
- [Risk] deterministic schema 與 audit 不能理解語意矛盾。→ Mitigation：本變更只補 artifact governance，semantic audit 必須另開高風險 proposal。
- [Risk] compiled pages 仍然偏 source-backed mirror，不是完整自動 wiki。→ Mitigation：先建立 schema 與 consolidation draft，使人工審核後的主題頁能透過 Joplin SSOT 進入下一輪 compile。
- [Risk] refs 格式若太自由會造成 draft provenance 難以驗證。→ Mitigation：只接受既有 note/page ref 模式與 safe id，無法驗證時回 user-safe error。
