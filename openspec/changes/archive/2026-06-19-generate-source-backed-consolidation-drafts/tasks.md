## 1. Phase 1 Source-Backed Drafts

- [x] 1.1 為 Requirement: Consolidation drafts preserve source refs before writeback 新增 node:test 覆蓋：當 `compiled/notes.json` 有 `note-a` 時，`wiki draft consolidate --ref note:note-a "Keycap material note"` 產生的 draft `content` 包含 goal、`note:note-a`、來源 title、來源摘錄，且內容長於 goal；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.2 實作 Generate consolidation content from compiled local artifacts：`draft consolidate` resolve `note:` 與 `page:` refs，只從 `compiled/` artifacts 讀來源，找不到來源時回 `DRAFT_SOURCE_MISSING` 且不寫 draft；用 1.1 與 missing source 測試驗證。
- [x] 1.3 實作 Use deterministic extractive formatting as the first version 並維持 Keep draft creation read-only toward durable stores：draft `content` 以固定 Markdown-like 格式輸出 goal、sources、bounded excerpts，不新增 dependency、不呼叫 Joplin／LLM、不修改 raw、compiled、graph、audit、status；用 `node --test test/wiki.test.js` 驗證。

## 2. Phase 2 Full-Library Candidates

- [x] 2.1 為 Requirement: Full-library candidate discovery uses local artifacts 新增 node:test 覆蓋：候選探索從 `compiled/notes.json` 讀多筆 notes，回傳 bounded candidates，每個 candidate 含 `candidate_id`、`refs`、`reason`、`priority`、`goal`；用 `node --test test/wiki.test.js` 驗證。
- [x] 2.2 實作 Add a bounded full-library candidate command：新增 operator 可執行的本機 candidate discovery flow，只讀 compiled artifacts，支援 bounded output，缺 compiled artifacts 時回穩定錯誤且不寫 candidate／draft；用 2.1 與 missing compiled 測試驗證。
- [x] 2.3 為 Requirement: Candidate drafts remain review-gated 新增 node:test 覆蓋：選定 candidate 後建立 `kind: "consolidate"` drafts，draft provenance 保留 candidate refs，content 使用 Phase 1 formatter，且不寫 Joplin；用 `node --test test/wiki.test.js` 驗證。
- [x] 2.4 實作 Convert accepted candidates into review drafts：candidate-to-draft flow 從 candidate id 產生 filesystem drafts，unknown candidate 回穩定 candidate missing code 且不寫 draft；用 2.3 與 unknown candidate 測試驗證。

## 3. Phase 3 Review Governance

- [x] 3.1 為 Requirement: Full-library consolidation automation is phased 新增 node:test 覆蓋：candidate draft approve 或 reject 後，本機 review evidence 連結 `candidate_id`、`draft_id`、`decision`、approved 時的 `joplin_note_id`；用 `node --test test/wiki.test.js` 驗證。
- [x] 3.2 實作 Track review governance with local artifacts：新增本機 review-state artifacts 記錄 pending、approved、rejected、rollback evidence，且 `wiki audit` 能讀出治理錯誤或統計；用 3.1 與 audit 測試驗證。
- [x] 3.3 維持 writeback gate：Phase 3 可以準備 approval evidence，但 durable Joplin writeback 仍只由 `wiki approve` 或等價人工審核 gate 觸發，不新增 scheduled writeback job；用 fetch spy 測試與 `git diff` 檢查驗證。

## 4. Operator Guidance And Final Verification

- [x] [P] 4.1 更新 `packaging/hermes/skills/wiki/SKILL.md`，讓 Hermes guidance 說明 Phase 1 explicit refs、Phase 2 full-library candidates、Phase 3 review governance，以及 `approve` writeback gate；用內容審查確認包含 `query/read/links`、candidate discovery、candidate-to-draft、`approve` 邊界。
- [x] [P] 4.2 更新 `docs/design.md`，記錄同一 change 分期完成全筆記庫自動整理：Split full-library automation into explicit phases、Add a bounded full-library candidate command、Convert accepted candidates into review drafts、Track review governance with local artifacts；用內容審查確認不承諾 LLM 摘要或背景排程。
- [x] 4.3 執行整體驗證：`node --test`、`spectra analyze generate-source-backed-consolidation-drafts --json`、`spectra validate generate-source-backed-consolidation-drafts` 全部通過。
