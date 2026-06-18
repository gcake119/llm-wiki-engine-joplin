## 1. Phase 1: Joplin notes pagination and sync observability

- [x] 1.1 實作 Phase 1: Sync pagination 與 Sync paginates Joplin notes：`wiki sync` 需循 Joplin Data API pagination 抓完所有 notes pages；以 Node built-in test 驗證 two-page fixture 同步到兩筆 raw body files。
- [x] 1.2 實作 Sync paginates Joplin notes 的 sync observability：成功 sync 的 `status.json` 需包含 `notes_seen`、`notes_written`、`pages_seen`、`warnings`；以 Node built-in test 驗證統計值。
- [x] 1.3 實作 Sync fails safely for malformed notes：unsafe note id 與 missing string body 需回 stable JSON error，不寫出 trusted raw cache；以 Node built-in test 驗證 `JOPLIN_NOTE_ID_UNSAFE` 與 `JOPLIN_NOTE_BODY_MISSING`。
- [x] 1.4 確認 Phase 1: Joplin notes pagination and sync observability 仍只使用 Joplin Data API read operations，不讀 SQLite、不寫 Joplin；以 code review 與 `npm test` 驗證。

## 2. Phase 2: Lexical query improvements with stdlib only

- [x] 2.1 實作 Phase 2: Query quality 與 Query ranks lexical matches deterministically：title match 權重高於 body-only match；以 Node built-in test 驗證 spec example 的排序。
- [x] 2.2 實作 Query ranks lexical matches deterministically 的 top-N limit：`wiki query` 回傳結果不得超過預設 limit；以 Node built-in test 驗證超量 fixture。
- [x] 2.3 實作 query source metadata：每筆結果包含 note id、title、parent id、snippet、score；以 Node built-in test 驗證 JSON shape。
- [x] 2.4 實作 Hermes uses local wiki tools instead of RAG：`wiki query` 與 `wiki compile` 不新增 RAG service、vector database、embedding pipeline 或 model-dependent retrieval；以 Node built-in test 或 code review 驗證。
- [x] 2.5 確認 Phase 2: Lexical query improvements with stdlib only 不新增 dependency、不呼叫 Joplin Data API、不寫 lock/raw/compiled/status；以 `npm test` 與 code review 驗證。

## 3. Phase 3: Minimal graph and links from existing artifacts

- [x] 3.1 實作 Compile produces a minimal graph artifact：`wiki compile` 成功後寫入 `graph/graph.json`；以 Node built-in test 驗證檔案存在且 deterministic。
- [x] 3.2 實作 Compile produces a minimal graph artifact 的 note nodes：每筆 compiled note 產生一個 note node；以 Node built-in test 驗證 node count 與 id/title。
- [x] 3.3 實作 Compile produces a minimal graph artifact 的 notebook parent edges：有 `parent_id` 的 note 產生 notebook parent edge；以 Node built-in test 驗證 edge shape。
- [x] 3.4 實作 Compile produces a minimal graph artifact 的 resolvable Markdown note links：只對已知 note id 產生 note-to-note link edge；以 Node built-in test 驗證 resolved link，並確認 unresolved link 不產生 edge。
- [x] 3.5 確認 Phase 3: Minimal graph and links from existing artifacts 不做 graph 推理、topic extraction、ontology 或 LLM relation extraction；以 code review 與 `npm test` 驗證。

## 4. Phase 4: Local note read tool

- [x] 4.1 實作 Phase 4: Local note read 與 Read returns a local note by id：新增 `wiki read <note-id>`，從 local compiled/raw artifacts 回傳單頁 note；以 Node built-in test 驗證 known note 回傳 id、title、parent_id、body_hash、plain_text、source、`evidence_status: "source_backed"`。
- [x] 4.2 實作 Read returns a local note by id 的 unknown note 行為：未知 note id 需回 stable JSON error `NOTE_NOT_FOUND` 與 `evidence_status: "not_found"`；以 Node built-in test 驗證。
- [x] 4.3 確認 Phase 4: Local note read tool 仍是 foreground local only：不呼叫 Joplin Data API、embedding、vector DB、LLM 或 external retrieval API；以 code review 與 `npm test` 驗證。

## 5. Phase 5: Link traversal tool

- [x] 5.1 實作 Phase 5: Link traversal 與 Links return local graph neighbors：新增 `wiki links <note-id>`，從 `graph/graph.json` 回傳 one-hop neighbors 與 edges；以 Node built-in test 驗證 known graph note。
- [x] 5.2 實作 Links return local graph neighbors 的 missing graph 行為：`graph/graph.json` 不存在時回 stable JSON error `GRAPH_NOT_FOUND` 與 `evidence_status: "graph_missing"`；以 Node built-in test 驗證。
- [x] 5.3 實作 Links return local graph neighbors 的 unknown note 行為：未知 note id 回 stable JSON error `NOTE_NOT_FOUND` 與 `evidence_status: "not_found"`；以 Node built-in test 驗證。
- [x] 5.4 確認 Phase 5: Link traversal tool 不做 multi-hop planning、semantic relation inference、ontology 或 graph database；以 code review 與 `npm test` 驗證。

## 6. Phase 6: Evidence sufficiency without LLM audit

- [x] 6.1 實作 Phase 6: Evidence sufficiency protocol 與 Read path reports evidence sufficiency：`wiki query` 有結果時回 `evidence_status: "source_backed"`，無結果時回 `evidence_status: "insufficient"`；以 Node built-in test 驗證。
- [x] 6.2 實作 `wiki read` 與 `wiki links` 的 evidence sufficiency protocol：依 local artifact availability 與 matched local sources 回 `source_backed`、`not_found` 或 `graph_missing`；以 Node built-in test 驗證。
- [x] 6.3 確認 Phase 6: Evidence sufficiency without LLM audit 不加入 LLM confidence scoring、answer grading、fact verification 或 contradiction detection；以 code review 與 `npm test` 驗證。

## 7. Phase 7: Source-backed wiki page model

- [x] 7.1 實作 Phase 7: Source-backed wiki page model 與 Compile produces source-backed wiki pages：定義最小 page artifact shape，包含 `page_id`、`title`、`aliases`、`tags`、`summary`、`sections`、`links`、`sources`；以 Node built-in test 驗證 JSON shape。
- [x] 7.2 實作 Compile produces source-backed wiki pages 的 source references：每個 fact-bearing section 必須包含至少一個 source note id；以 Node built-in test 驗證缺 source 的 section 被拒絕或標記為 evidence gap。
- [x] 7.3 確認 Phase 7: Source-backed wiki page model 不建立 unsourced summaries、ontology、graph inference 或 cloud LLM calls；以 code review 與 `npm test` 驗證。

## 8. Phase 8: Source-backed page artifacts through compile

- [x] 8.1 實作 Phase 8: Source-backed page artifacts through compile 與 Compile produces source-backed wiki pages 的 local page artifacts：`wiki compile` 成功後可寫入 `compiled/pages.json` 與 local page files；以 Node built-in test 驗證 artifacts 存在且可重建。
- [x] 8.2 實作 Compile produces source-backed wiki pages 的 local-only boundary：`wiki compile` 產生 pages 時不寫 Joplin、drafts、Error Book 或 foreground query state；以 Node built-in test 驗證。
- [x] 8.3 確認 Phase 8: Source-backed page artifacts through compile 不新增 `wiki synthesize`，且不在 `wiki query` 期間建立 pages；以 code review 與 CLI smoke 驗證 query 不改變 compiled artifacts。

## 9. Phase 9: Page-aware traversal semantics

- [x] 9.1 實作 Phase 9: Page-aware traversal semantics 與 Read path supports page-aware refs：`wiki query` 結果包含 `ref` 與 `kind`，可區分 `note:<id>` 與 `page:<id>`；以 Node built-in test 驗證。
- [x] 9.2 實作 Read path supports page-aware refs 的 `wiki read` 行為：`wiki read note:<id>` 讀 source note，`wiki read page:<id>` 讀 compiled page；以 Node built-in test 驗證兩種 refs。
- [x] 9.3 實作 Read path supports page-aware refs 的 `wiki links` 行為：`wiki links note:<id>` 與 `wiki links page:<id>` 都回 one-hop local graph relationships；以 Node built-in test 驗證。
- [x] 9.4 確認 Phase 9: Page-aware traversal semantics 不新增 `wiki ask`、hidden retrieval 或 automatic multi-hop planning；以 code review 與 `npm test` 驗證。

## 10. Phase 10: Local audit artifact

- [x] 10.1 實作 Phase 10: Local audit artifact 與 Audit writes deterministic Error Book entries：新增 `wiki audit`，對 dangling link、missing source、unsupported claim、stale artifact、evidence gap 寫入 `audit/error-book.json`；以 Node built-in test 驗證 entries shape。
- [x] 10.2 實作 Audit writes deterministic Error Book entries 的 counts by kind：`wiki audit` 回傳 total error count 與 kind counts；以 Node built-in test 驗證 JSON output。
- [x] 10.3 確認 Phase 10: Local audit artifact 不新增 `wiki error-book`、不使用 LLM grading、不寫 Joplin、不自動修復 compiled artifacts；以 code review 與 `npm test` 驗證。

## 11. Phase 11: Draft-first capture, feedback, and consolidation

- [x] 11.1 實作 Phase 11: Draft-first capture, feedback, and consolidation 與 Draft commands create filesystem drafts：`wiki draft telegram` 與 `wiki draft discord` 以 local input 產生 reviewable filesystem draft；以 Node built-in test 驗證 draft shape。
- [x] 11.2 實作 Draft commands create filesystem drafts 的 feedback / consolidation draft：`wiki draft feedback` 與 `wiki draft consolidate` 產生含 provenance、source refs 與 intended target 的 filesystem draft；以 Node built-in test 驗證。
- [x] 11.3 確認 Phase 11: Draft-first capture, feedback, and consolidation 不新增 `wiki consolidate`，且不寫 Joplin、raw cache、compiled pages、graph、Error Book 或 status；以 Node built-in test 驗證。

## 12. Phase 12: Approve-gated Joplin writeback

- [x] 12.1 實作 Phase 12: Approve-gated Joplin writeback 與 Approve gates Joplin writeback：`wiki approve <draft-id>` 只在 draft 有 provenance、target notebook、conflict behavior 時透過 Joplin Data API 寫回；以 Node built-in test 驗證 success output 包含 Joplin note id。
- [x] 12.2 實作 Approve gates Joplin writeback 的 failure behavior：Joplin writeback 失敗時回 stable JSON error，且保留 local draft 與 provenance；以 Node built-in test 驗證。
- [x] 12.3 確認 Safety boundary for local reads and durable writes：除 `wiki approve <draft-id>` 外，`wiki sync`、`wiki compile`、`wiki query`、`wiki read`、`wiki links`、`wiki audit`、`wiki draft` 都不寫 Joplin notes；以 Node built-in test 與 code review 驗證。

## 13. Verification

- [x] 13.1 執行 `npm test`，確認 sync pagination、malformed note、query ranking、read by id、graph artifact、links traversal、evidence sufficiency、source-backed pages、page-aware refs、Error Book artifact、drafts、approve-gated writeback 全部通過。
- [x] 13.2 執行 manual smoke：`node src/wiki.js sync` safe failure、fixture `compile`、fixture `query`、fixture `read`、fixture `links`、fixture `audit`、fixture `draft`、fixture `approve`，確認輸出為 user-safe JSON。
- [x] 13.3 執行 `spectra validate --all` 與 `spectra analyze strengthen-wiki-read-path --json`，確認 artifacts 沒有 critical findings。
- [x] 13.4 檢查 `git status --short`，確認沒有 runtime cache、secret、vector DB 或本機 generated state 進版控。
