## Why

目前 `wiki draft consolidate` 已能建立可審核草稿與保留 provenance，但實測顯示草稿內容只寫入操作者輸入的目標句，沒有從來源筆記萃取可沉澱的知識。這使架構閉環雖然成立，卻還不能交付「自動整理全筆記庫知識」的最小可用能力。

目標是在同一個 change 內分期完成全筆記庫自動整理能力，而不是只停在單筆 refs 整理。這個問題屬於成熟的知識管理與內容整理領域，常見做法是 curation pipeline、extractive summarization、provenance-preserving review workflow。此變更採用分期交付：Phase 1 交付 source-backed 單筆或少量 refs 整理稿，Phase 2 交付全庫整理候選與批次 draft，Phase 3 交付審核治理與可追溯沉澱閉環。

## What Changes

- Phase 1：修改 `wiki draft consolidate --ref ... "目標"`，讓 consolidation draft 的 `content` 由來源 artifact 產生可審核整理稿，而不是只保存操作者輸入的目標句。
- Phase 1：整理稿 SHALL 包含標題、整理目的、來源 refs、來源摘要或重點摘錄，並保留原本 review-gated writeback 邊界。
- Phase 1：當來源 ref 無法從 compiled artifacts 讀取時，draft 建立 SHALL 失敗並回傳穩定錯誤，不產生看似已整理但無來源支撐的草稿。
- Phase 1：保持本機、deterministic、無外部服務：不呼叫 Joplin Data API、LLM、embedding service、vector database 或外部 retrieval API。
- Phase 2：從全庫 compiled artifacts 產生整理候選清單，例如依 notebook、title keyword、updated time、source density 或 duplicate-like titles 找出需要整理的 refs；此 phase SHALL 只產生候選與 draft，不自動 approve。
- Phase 2：提供 operator 可執行的本機 command 或子模式，能在 5805-note 等級 compiled index 上輸出 bounded candidate list 與 batch consolidation drafts。
- Phase 3：建立審核佇列、批次 approve policy、品質檢查與 rollback evidence artifacts，讓全庫整理能長期運作而不破壞 Joplin SSOT。
- Phase 3：所有 durable writeback 仍 SHALL 經過 `wiki approve` 或等價的人工審核 gate。

## Non-Goals

- 本 change 不引入 LLM 摘要品質最佳化。
- 本 change 不做語意分類、主題聚類、embedding retrieval 或跨筆記推理。
- 本 change 不改 `wiki approve` 的 writeback 模型，也不讓 `draft` 直接寫 Joplin。
- 本 change 不新增相依套件；先用 Node stdlib 與已編譯 artifacts 完成最小可驗證版本。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 修改 consolidation draft 的內容產生契約，從保存操作者文字提升為 source-backed 本機整理稿，並分期完成全筆記庫候選、批次 draft、審核治理與可追溯沉澱閉環。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - Modified: src/wiki.js
  - Modified: test/wiki.test.js
  - Modified: packaging/hermes/skills/wiki/SKILL.md
  - Modified: docs/design.md
  - New: openspec/changes/generate-source-backed-consolidation-drafts/specs/hermes-wiki-engine/spec.md
  - Removed: none
