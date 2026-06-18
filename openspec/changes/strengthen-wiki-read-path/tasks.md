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

## 4. Phase 4: Capture and writeback stay deferred

- [ ] 4.1 實作 Phase 4: Deferred capture / writeback boundary 與 Capture and writeback remain deferred during read path hardening：`wiki draft telegram`、`wiki draft discord`、`wiki approve` 仍回 stable not implemented JSON；以 Node built-in test 驗證。
- [ ] 4.2 確認 Phase 4: Capture and writeback stay deferred 不寫 Joplin、raw cache、compiled index、graph 或 status；以 Node built-in test 驗證 foreground / capture commands do not create job files。

## 5. Verification

- [ ] 5.1 執行 `npm test`，確認 sync pagination、malformed note、query ranking、graph artifact、deferred writeback 全部通過。
- [ ] 5.2 執行 manual smoke：`node src/wiki.js sync` safe failure、fixture `compile`、fixture `query`，確認輸出為 user-safe JSON。
- [ ] 5.3 執行 `spectra validate --all` 與 `spectra analyze strengthen-wiki-read-path --json`，確認 artifacts 沒有 critical findings。
- [ ] 5.4 檢查 `git status --short`，確認沒有 runtime cache、secret、vector DB 或本機 generated state 進版控。
