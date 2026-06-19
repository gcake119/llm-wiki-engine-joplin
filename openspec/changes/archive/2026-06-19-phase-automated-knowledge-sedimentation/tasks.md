## 1. Phase 1：Background Pipeline Runner

- [x] 1.1 以 test-first 定義 `Automation runner executes review-gated maintenance pipeline`：`wiki automate once` 會依序記錄 sync、compile、draft candidate discovery、audit 的 step artifact，且不觸發 approve 或 Joplin writeback；以 `node --test test/wiki.test.js --test-name-pattern "automate"` 驗證紅燈測試。
- [x] 1.2 實作 `wiki automate once` 的一-shot runner contract：成功時寫入 `automation/runs/<run-id>.json` 與 `automation/latest.json`，失敗時停在 failed step 並保留 evidence；以同一個 automate 測試指令驗證綠燈。
- [x] 1.3 實作 automation busy／lock behavior：既有 wiki state lock 存在時回傳 busy，不啟動 sync、compile、draft、audit、approve；以 automate busy 測試與一次 CLI fixture 驗證。

## 2. Phase 2：LLM-Assisted Consolidation

- [x] 2.1 以 test-first 定義 `LLM-assisted consolidation creates source-backed review drafts`：有 compiled source refs 時會產生含 source-backed summary、dedupe recommendation、open questions、`provenance.llm` 的 reviewable draft；以 `node --test test/wiki.test.js --test-name-pattern "llm consolidation"` 驗證紅燈測試。
- [x] 2.2 實作 local LLM provider invocation contract：預設使用 local `ollama call` 介面或測試替身，成功時產生 review draft，provider missing 或 source missing 時 fail closed 且不寫 partial draft；以 llm consolidation 測試驗證。
- [x] 2.3 更新 Hermes skill 與 `docs/design.md` 的 LLM-assisted 操作邊界：文件清楚標示 LLM output 只是 reviewable draft、不能當 answer source、不能繞過 `wiki approve`；以內容 review 與 `spectra analyze` 驗證。

## 3. Phase 3：Semantic Retrieval Layer

- [x] 3.1 以 test-first 定義 `Semantic retrieval builds rebuildable source-ref index`：`wiki semantic build` 只從 compiled artifacts 建立含 chunk id、page id、source refs、content hash、embedding metadata 的 index；以 `node --test test/wiki.test.js --test-name-pattern "semantic"` 驗證紅燈測試。
- [x] 3.2 實作 semantic build／query artifact contract：query 回傳 scored refs 與 snippets，index missing、stale 或 provider missing 時回傳清楚狀態，既有 keyword/read flow 不被阻塞；以 semantic 測試與 CLI fixture 驗證。
- [x] 3.3 更新 foreground retrieval 文件：`wiki query` 可使用 semantic refs 但最終仍必須回到 compiled page／`wiki read` source refs，不隱性啟動 embedding build；以內容 review 與 `spectra analyze` 驗證。

## 4. Phase 4：Capture Bot／Ingestion

- [x] 4.1 以 test-first 定義 `Capture ingestion creates allowlisted filesystem drafts`：Telegram／Discord normalized events 通過 allowlist 後會產生 redacted filesystem draft，並包含 source、message id、author handle hash、timestamp、dedupe key、redaction warnings；以 `node --test test/wiki.test.js --test-name-pattern "capture"` 驗證紅燈測試。
- [x] 4.2 實作 capture ingestion contract：`wiki capture telegram --input <path>` 與 `wiki capture discord --input <path>` 支援 allowlist、rate limit、duplicate rejection、capture run evidence，且不建立或更新 Joplin note；以 capture 測試與 CLI fixture 驗證。
- [x] 4.3 更新 Hermes skill 的 capture bot 邊界：明確說明 repo 內先支援 ingestion／filesystem draft，實際 Telegram／Discord adapter 可由 Hermes 或外部 process 呼叫，正式沉澱仍走 review／approve；以內容 review 驗證。

## 5. Cross-Phase Safety 與收尾

- [x] 5.1 驗證 `Automated sedimentation preserves approve-only writeback`：automation、LLM、semantic retrieval、capture ingestion 命令都只能產生 local artifacts／drafts／indexes，唯一 Joplin writeback path 仍是 `wiki approve`；以新增或既有 writeback guard 測試驗證。
- [x] 5.2 驗證 foreground read path 不觸發 hidden background work：read/query 不會隱性啟動 sync、compile、LLM、semantic build、capture ingestion 或 approve；以 regression test 驗證。
- [x] 5.3 執行最小 repo 驗證與 Spectra 驗證：`node --test test/wiki.test.js`、`spectra analyze phase-automated-knowledge-sedimentation`、`spectra validate phase-automated-knowledge-sedimentation --strict` 全部通過，並確認 tasks 狀態可由 `$spectra-apply` 接續。

## 6. Phase 5：Periodic Whole-Library Consolidation

- [x] 6.1 以 test-first 定義 `Periodic whole-library consolidation creates reviewable drafts` 的 `wiki automate status` contract：latest pointer 存在時回傳 latest run 與 summary reference，missing 時回 `AUTOMATION_STATUS_MISSING`，且不建立 automation、draft、semantic、capture、review 或 Joplin artifacts；以 `node --test test/wiki.test.js --test-name-pattern "periodic"` 驗證紅燈測試。
- [x] 6.2 實作 `wiki automate status`：讀取 `automation/latest.json`、對應 `automation/runs/<run-id>.json` 與可選 `automation/summaries/<run-id>.json`，回傳 machine-readable JSON，不啟動任何背景工作；以 periodic status 測試與一次 CLI fixture 驗證。
- [x] 6.3 以 test-first 定義 `wiki automate once --draft-top N` 的 bounded top-N draft contract：`--draft-top 2` 最多從 candidate artifact 產生兩個 LLM-assisted reviewable consolidation drafts，summary 記錄 `candidates_seen`、`drafts_created`、`draft_ids`、`audit_total_errors`、`warnings`、`next_actions`，且不呼叫 approve；以 `node --test test/wiki.test.js --test-name-pattern "periodic"` 驗證紅燈測試。
- [x] 6.4 實作 periodic `--draft-top N` parsing 與 summary artifact：省略或 `--draft-top 0` 時只跑 maintenance pipeline 並建立零 draft summary，負數或非整數在 sync 前回 `AUTOMATION_DRAFT_TOP_INVALID`；以 periodic parsing／summary 測試驗證。
- [x] 6.5 實作 top-N LLM-assisted draft creation：在 candidate discovery 與 audit 成功後，依候選順序對前 N 個 pending candidates 產生 `kind: "consolidate"` draft，保留 source refs 與 `provenance.llm`，provider missing 時 summary warning 為 `LLM_PROVIDER_MISSING` 且 draft count 為 0；以 periodic provider-missing 與 top-N 測試驗證。
- [x] 6.6 實作 periodic operator notification summary：`wiki automate once --draft-top N --notify` 在 maintenance 成功或 LLM draft failure warning 後送出不含 token、raw prompt、raw note body 的摘要，notification failure 只寫入 summary 不讓 run 失敗；以 periodic notify 測試驗證。
- [x] 6.7 更新 Hermes skill 與 `docs/design.md` 的定期全庫整理操作邊界：文件明確說明 Hermes／launchd／cron 可定期觸發 `wiki automate once --draft-top N --notify`，repo 不內建 daemon，不自動選永久 target notebook，不自動 approve；以內容 review 與 `spectra analyze` 驗證。
- [x] 6.8 執行新增 Phase 5 的最小驗證：`node --test test/wiki.test.js --test-name-pattern "periodic"`、`node --test test/wiki.test.js`、`spectra analyze phase-automated-knowledge-sedimentation`、`spectra validate phase-automated-knowledge-sedimentation --strict` 全部通過，並確認 `$spectra-apply phase-automated-knowledge-sedimentation` 顯示 15 個已完成 task 與 8 個 pending task。
