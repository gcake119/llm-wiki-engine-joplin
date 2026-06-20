## Summary

改善 `wiki query --rerank-llm` 的搜尋品質，讓第一階段 deterministic keyword candidates 更重視多詞共現與語境覆蓋，並讓 rerank prompt 更明確排除一般 Joplin 教學、一般 AI 助理文章與鍵盤品牌 Hermes。

## Motivation

目前 rerank plumbing 已可用，但第一階段候選太寬。只有 `Joplin` 或只有 `Hermes` 的泛用文章可能混進候選，LLM rerank 也可能因 prompt 未明確定義 Hermes wiki engine 語境而把一般 Joplin 教學排太高。

這屬於成熟的 information retrieval / lexical retrieval tuning 問題。主流做法是保留 deterministic first-stage retrieval，調整詞項覆蓋率、片段共現與 domain-specific downranking，再把 bounded candidates 交給 reranker；本 change 不導入 vector DB、RAG service 或 notebook allowlist。

## Proposed Solution

- 調整 deterministic scoring，讓同篇或近距離片段命中多個查詢詞的候選高於單詞命中候選。
- 降低只有單一泛用詞命中的文章，尤其是只有 `Joplin`、只有 `Hermes`、或鍵盤品牌 `Gamdias Hermes` 這類候選。
- 保留全庫查詢與 bounded candidate set，不做 notebook allowlist 或 denylist。
- 更新 rerank prompt，明確要求辨識 `Hermes wiki engine` / `Hermes 長期記憶系統` 語境，並降級一般 Joplin 教學、一般 AI 助理文章與鍵盤品牌 Hermes。
- LLM 仍只能輸出 JSON array，不能直接回答問題；LLM output 只作排序，不作事實來源。

## Non-Goals

- 不新增 vector DB、embedding store、RAG service 或新依賴。
- 不讓 `wiki query` 預設呼叫 LLM。
- 不擴大 rerank 候選上限。
- 不導入 Joplin notebook allowlist / denylist。
- 不新增 Joplin writeback、draft creation、sync、compile 或 background automation 行為。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - Modified: `src/wiki.js`
  - Modified: `test/wiki.test.js`
  - Modified: `openspec/specs/hermes-wiki-engine/spec.md`
  - New: `openspec/changes/improve-query-rerank-quality/specs/hermes-wiki-engine/spec.md`
  - New: `openspec/changes/improve-query-rerank-quality/tasks.md`
  - Removed: none
