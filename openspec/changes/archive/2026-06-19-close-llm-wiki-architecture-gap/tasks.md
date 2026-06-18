## 1. 測試先行

- [x] 1.1 為 Compile writes a local wiki schema artifact 新增 node:test 案例，驗證 wiki compile 成功後產生 compiled/schema.json，且包含 schema_version、ref_kinds、draft_kinds、page_model、governance_rules；以 node --test test/wiki.test.js 驗證失敗再進入實作。
- [x] 1.2 為 Consolidation drafts preserve source refs before writeback 新增 node:test 案例，驗證 wiki draft consolidate --ref note:note-a --ref page:page-topic 內容會產生 kind=consolidate、pending_review、provenance.refs 的 draft，且不呼叫 Joplin mock；以 node --test test/wiki.test.js 驗證失敗再進入實作。
- [x] 1.3 為 Governance audit covers consolidation artifacts 新增 node:test 案例，驗證 audit 對缺 target notebook 的 consolidate draft 回報 draft_target_missing，對不存在的 note ref 回報 missing_source；以 node --test test/wiki.test.js 驗證失敗再進入實作。

## 2. Runtime contract

- [x] 2.1 實作 Write a local wiki schema artifact during compile，讓 wiki compile 寫出 compiled/schema.json 並保持 local/model-free；完成後以 1.1 測試與 node --test test/wiki.test.js 驗證。
- [x] 2.2 實作 Keep consolidation as a reviewable draft path，讓 wiki draft consolidate 驗證 safe note/page refs、保存 provenance.refs、拒絕缺內容與 unsafe refs，並保持不修改 raw/compiled/graph/audit/Joplin；完成後以 1.2 測試與 node --test test/wiki.test.js 驗證。
- [x] 2.3 實作 Extend audit as local governance rather than semantic grading，讓 wiki audit 讀 drafts 與 compiled local artifacts 後寫入 draft_target_missing 與 missing_source entries，且缺 optional artifacts 時不崩潰；完成後以 1.3 測試與 node --test test/wiki.test.js 驗證。
- [x] 2.4 確認 Keep compiled pages source-backed and deterministic 邊界不被破壞，wiki query/read/links/compile 不呼叫 LLM、embedding、vector DB 或 Joplin readback during foreground read path；完成後以既有 read path 測試與 node --test test/wiki.test.js 驗證。

## 3. Operator guidance

- [x] [P] 3.1 更新 Hermes skill describes consolidation as review-gated memory sedimentation 的 operator guidance，讓 packaging/hermes/skills/wiki/SKILL.md 指示整理知識時使用 wiki draft consolidate、寫回 Joplin 前必須 wiki approve、記憶回答仍只用 query/read/links sources；完成後以內容審查確認三條規則都存在。
- [x] [P] 3.2 更新 docs/design.md，記錄 Update Hermes skill as the operator contract 與 consolidation governance 邊界，明確保留 Joplin SSOT、draft/approve gate、foreground read path deterministic；完成後以內容審查確認 Goals、Architecture、Non-goals 沒有引入 deferred surfaces。

## 4. Validation

- [x] 4.1 執行 node --test，確認 schema artifact、consolidation draft、governance audit、approve gate 與既有 read path 測試全數通過。
- [x] 4.2 執行 spectra analyze close-llm-wiki-architecture-gap --json 並修正 Critical/Warning，確認 proposal、design、spec、tasks 彼此一致。
- [x] 4.3 執行 spectra validate close-llm-wiki-architecture-gap，確認 Spectra artifacts 可進入 apply；若失敗，依錯誤修正 artifact 後重新驗證。
