## 1. 測試先行鎖定規格

- [x] 1.1 為 Candidate discovery uses deterministic multi-signal scoring 新增 node:test cases，覆蓋 `reasons`、`score`、`priority`、bounded limit 與 stable ordering；以 `npm test` 驗證新測試先能描述預期輸出。
- [x] 1.2 為 Compile produces grouped source-backed wiki pages 新增 node:test cases，覆蓋兩篇 related notes 產生同一 grouped page、page sections 保留 sources、`wiki read page:<id>` 與 `wiki links page:<id>` 可讀可連；以 `npm test` 驗證測試案例存在且會檢查 page shape。
- [x] 1.3 為 Consolidation drafts accept explicit target notebooks 新增 node:test cases，覆蓋 `--target-notebook` 寫入 `intended_target.notebook_id`、unsafe target 回 `DRAFT_TARGET_UNSAFE`、approve 仍要求 target；以 `npm test` 驗證 draft target contract 被測到。
- [x] 1.4 為 Audit covers candidate and target governance 新增 node:test cases，覆蓋 missing candidate source、`candidate_too_small`、`draft_target_missing` 與 local-only audit；以 `npm test` 驗證 error-book entries 與 `kind_counts`。

## 2. CLI 與 artifact 行為

- [x] 2.1 實作 Deterministic multi-signal candidates：`wiki draft candidates` 只讀 compiled artifacts 與 graph，輸出含 `reasons`、`score`、`priority`、`proposed_target` 的 bounded candidates；以 `npm test` 驗證 candidate ordering、limit 與無外部呼叫。
- [x] 2.2 實作 Source-backed topic/entity page compilation：`wiki compile` 產生可聚合多個 source notes 的 pages，並維持 `compiled/pages.json`、單頁檔、`read page:`、`links page:` 相容；以 `npm test` 驗證 grouped page、source refs 與 local-only compile。
- [x] 2.3 實作 Review-gated target ergonomics：`wiki draft consolidate` 與 `wiki draft candidate` 解析 `--target-notebook`，安全寫入 draft target，並保持 approve 為唯一 Joplin writeback gate；以 `npm test` 驗證 target notebook、unsafe target 與 approve failure mode。
- [x] 2.4 實作 Governance audit for consolidation artifacts：`wiki audit` 讀取 candidates、pages、drafts/reviews，寫入 candidate 與 target governance errors，不修改 Joplin 或 durable artifacts；以 `npm test` 驗證 `audit/error-book.json` 與 command output。

## 3. 文件與 Hermes 操作指引

- [x] [P] 3.1 更新 `docs/design.md`，讓 durable design 說明 multi-signal candidate、grouped page、target notebook 與 audit governance 的實際邊界；以人工內容檢查確認 Non-goals 仍排除 RAG、embedding、LLM retrieval、Joplin SQLite 與自動 approve。
- [x] [P] 3.2 更新 `packaging/hermes/skills/wiki/SKILL.md`，讓 Hermes 在全庫整理時依序使用 `wiki draft candidates`、`wiki draft candidate`、`wiki audit`、`wiki approve`，且不得把 draft 當 foreground answer source；以人工內容檢查確認 skill 保留 source-backed answer 與 writeback gate 規則。

## 4. 最終驗證

- [x] 4.1 執行 `npm test`，確認所有 wiki CLI tests 通過，且沒有引入新 dependency 或非 stdlib runtime requirement。
- [x] 4.2 執行 `spectra analyze strengthen-library-consolidation --json` 與 `spectra validate strengthen-library-consolidation`，確認 proposal、design、spec、tasks 之間沒有 Critical 或 Warning 且 change 可進入 apply。

## 5. Deferred automation track：後續自動化缺口規劃

- [x] [P] 5.1 規劃背景排程或 daemon 的下一輪 change：列出 `wiki sync`、`wiki compile`、`wiki draft candidates`、`wiki audit` 的觸發時機、lock 行為、失敗重試、通知輸出與不影響 foreground `wiki query/read` 的驗收條件。
- [x] [P] 5.2 規劃 LLM 摘要與語意去重的下一輪 change：定義只從 compiled source refs 產生 draft summary 或 dedupe recommendation、必須保留 provenance、不得直接寫回 Joplin 的驗收條件。
- [x] [P] 5.3 規劃 embedding/vector/RAG retrieval 的下一輪 change：定義索引必須由 compiled artifacts 可重建、foreground answer 必須帶 source refs、Joplin 仍為 SSOT，以及不導入 unsupported answer 的驗收條件。
- [x] [P] 5.4 規劃自動判斷「值得保存」與 draft promotion 的下一輪 change：定義自動化只能產生 candidate 或 reviewable draft、approved draft 如何經由 Joplin writeback 與下一輪 sync/compile 進入正式 page，並列出不得跳過 approve gate 的驗收條件。
- [x] [P] 5.5 規劃 Telegram／Discord ingestion bot 的下一輪 change：定義 allowlist、rate limit、redaction、attachment policy、secret handling、failure evidence，以及從 bot capture 到 filesystem draft 的最小可驗收流程。
