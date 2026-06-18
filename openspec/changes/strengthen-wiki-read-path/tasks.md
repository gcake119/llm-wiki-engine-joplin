## 1. Phase 1: Joplin notes pagination and sync observability

- [ ] 1.1 實作 Phase 1: Sync pagination 與 Sync paginates Joplin notes：`wiki sync` 需循 Joplin Data API pagination 抓完所有 notes pages；以 Node built-in test 驗證 two-page fixture 同步到兩筆 raw body files。
- [ ] 1.2 實作 Sync paginates Joplin notes 的 sync observability：成功 sync 的 `status.json` 需包含 `notes_seen`、`notes_written`、`pages_seen`、`warnings`；以 Node built-in test 驗證統計值。
- [ ] 1.3 實作 Sync fails safely for malformed notes：unsafe note id 與 missing string body 需回 stable JSON error，不寫出 trusted raw cache；以 Node built-in test 驗證 `JOPLIN_NOTE_ID_UNSAFE` 與 `JOPLIN_NOTE_BODY_MISSING`。
- [ ] 1.4 確認 Phase 1: Joplin notes pagination and sync observability 仍只使用 Joplin Data API read operations，不讀 SQLite、不寫 Joplin；以 code review 與 `npm test` 驗證。

## 2. Phase 2: Lexical query improvements with stdlib only

- [ ] 2.1 實作 Phase 2: Query quality 與 Query ranks lexical matches deterministically：title match 權重高於 body-only match；以 Node built-in test 驗證 spec example 的排序。
- [ ] 2.2 實作 Query ranks lexical matches deterministically 的 top-N limit：`wiki query` 回傳結果不得超過預設 limit；以 Node built-in test 驗證超量 fixture。
- [ ] 2.3 實作 query source metadata：每筆結果包含 note id、title、parent id、snippet、score；以 Node built-in test 驗證 JSON shape。
- [ ] 2.4 實作 Hermes uses local wiki tools instead of RAG：`wiki query` 與 `wiki compile` 不新增 RAG service、vector database、embedding pipeline 或 model-dependent retrieval；以 Node built-in test 或 code review 驗證。
- [ ] 2.5 確認 Phase 2: Lexical query improvements with stdlib only 不新增 dependency、不呼叫 Joplin Data API、不寫 lock/raw/compiled/status；以 `npm test` 與 code review 驗證。

## 3. Phase 3: Minimal graph and links from existing artifacts

- [ ] 3.1 實作 Compile produces a minimal graph artifact：`wiki compile` 成功後寫入 `graph/graph.json`；以 Node built-in test 驗證檔案存在且 deterministic。
- [ ] 3.2 實作 Compile produces a minimal graph artifact 的 note nodes：每筆 compiled note 產生一個 note node；以 Node built-in test 驗證 node count 與 id/title。
- [ ] 3.3 實作 Compile produces a minimal graph artifact 的 notebook parent edges：有 `parent_id` 的 note 產生 notebook parent edge；以 Node built-in test 驗證 edge shape。
- [ ] 3.4 實作 Compile produces a minimal graph artifact 的 resolvable Markdown note links：只對已知 note id 產生 note-to-note link edge；以 Node built-in test 驗證 resolved link，並確認 unresolved link 不產生 edge。
- [ ] 3.5 確認 Phase 3: Minimal graph and links from existing artifacts 不做 graph 推理、topic extraction、ontology 或 LLM relation extraction；以 code review 與 `npm test` 驗證。

## 4. Phase 4: Local note read tool

- [ ] 4.1 實作 Phase 4: Local note read 與 Read returns a local note by id：新增 `wiki read <note-id>`，從 local compiled/raw artifacts 回傳單頁 note；以 Node built-in test 驗證 known note 回傳 id、title、parent_id、body_hash、plain_text、source、`evidence_status: "source_backed"`。
- [ ] 4.2 實作 Read returns a local note by id 的 unknown note 行為：未知 note id 需回 stable JSON error `NOTE_NOT_FOUND` 與 `evidence_status: "not_found"`；以 Node built-in test 驗證。
- [ ] 4.3 確認 Phase 4: Local note read tool 仍是 foreground local only：不呼叫 Joplin Data API、embedding、vector DB、LLM 或 external retrieval API；以 code review 與 `npm test` 驗證。

## 5. Phase 5: Link traversal tool

- [ ] 5.1 實作 Phase 5: Link traversal 與 Links return local graph neighbors：新增 `wiki links <note-id>`，從 `graph/graph.json` 回傳 one-hop neighbors 與 edges；以 Node built-in test 驗證 known graph note。
- [ ] 5.2 實作 Links return local graph neighbors 的 missing graph 行為：`graph/graph.json` 不存在時回 stable JSON error `GRAPH_NOT_FOUND` 與 `evidence_status: "graph_missing"`；以 Node built-in test 驗證。
- [ ] 5.3 實作 Links return local graph neighbors 的 unknown note 行為：未知 note id 回 stable JSON error `NOTE_NOT_FOUND` 與 `evidence_status: "not_found"`；以 Node built-in test 驗證。
- [ ] 5.4 確認 Phase 5: Link traversal tool 不做 multi-hop planning、semantic relation inference、ontology 或 graph database；以 code review 與 `npm test` 驗證。

## 6. Phase 6: Evidence sufficiency without LLM audit

- [ ] 6.1 實作 Phase 6: Evidence sufficiency protocol 與 Read path reports evidence sufficiency：`wiki query` 有結果時回 `evidence_status: "source_backed"`，無結果時回 `evidence_status: "insufficient"`；以 Node built-in test 驗證。
- [ ] 6.2 實作 `wiki read` 與 `wiki links` 的 evidence sufficiency protocol：依 local artifact availability 與 matched local sources 回 `source_backed`、`not_found` 或 `graph_missing`；以 Node built-in test 驗證。
- [ ] 6.3 確認 Phase 6: Evidence sufficiency without LLM audit 不加入 LLM confidence scoring、answer grading、fact verification 或 contradiction detection；以 code review 與 `npm test` 驗證。

## 7. Phase 7: Page synthesis and self-evolving loop stay deferred

- [ ] 7.1 實作 Wiki page synthesis remains deferred：`wiki compile` 只寫 compiled notes 與 graph artifacts，不產生 topic pages、entity pages、cross-note summaries 或 synthesized wiki documents；以 Node built-in test 或 code review 驗證。
- [ ] 7.2 實作 Self-evolving memory loop remains deferred：`wiki query`、`wiki read`、`wiki links`、`wiki compile` 不寫 Error Book、feedback、consolidation drafts、approved memory 或 Joplin notes；以 Node built-in test 或 code review 驗證。
- [ ] 7.3 實作 Phase 7: Deferred synthesis / self-evolving boundary 與 Capture and writeback remain deferred during read path hardening：`wiki draft telegram`、`wiki draft discord`、`wiki approve` 仍回 stable not implemented JSON；以 Node built-in test 驗證。
- [ ] 7.4 確認 Phase 7: Page synthesis and self-evolving loop stay deferred 不寫 Joplin、raw cache、compiled index、graph 或 status；以 Node built-in test 驗證 foreground / capture commands do not create job files。

## 8. Legacy deferred capture and writeback boundary

- [ ] 8.1 確認 Deferred capture / writeback boundary 與 Capture and writeback remain deferred during read path hardening 維持不變：Telegram、Discord、Joplin writeback、`wiki approve` 仍不在本 change 實作；以 code review 驗證。

## 9. Verification

- [ ] 9.1 執行 `npm test`，確認 sync pagination、malformed note、query ranking、read by id、graph artifact、links traversal、evidence sufficiency、deferred synthesis、deferred writeback 全部通過。
- [ ] 9.2 執行 manual smoke：`node src/wiki.js sync` safe failure、fixture `compile`、fixture `query`、fixture `read`、fixture `links`，確認輸出為 user-safe JSON。
- [ ] 9.3 執行 `spectra validate --all` 與 `spectra analyze strengthen-wiki-read-path --json`，確認 artifacts 沒有 critical findings。
- [ ] 9.4 檢查 `git status --short`，確認沒有 runtime cache、secret、vector DB 或本機 generated state 進版控。
