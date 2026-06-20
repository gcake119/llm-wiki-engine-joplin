## Context

`wiki query --rerank-llm` 已具備 Ollama plumbing，但搜尋品質仍受 deterministic first-stage candidates 影響。若第一階段把只有單一 `Hermes` 或 `Joplin` 的泛用文章排太高，LLM rerank 會收到較弱的候選排序訊號，也可能被一般 Joplin 教學或鍵盤品牌 Hermes 誤導。

這是 lexical retrieval tuning，不是 RAG 架構變更。既有安全邊界維持不變：全庫可查、預設 deterministic、`--rerank-llm` 只重排 bounded source refs、不新增依賴、不寫回 Joplin。

## Implementation Contract

### Deterministic candidate ranking

- `wiki query` without `--rerank-llm` MUST NOT call LLM providers.
- Scoring MUST continue to read only `compiled/notes.json`.
- Candidates with multiple query terms in the same note or nearby local context SHOULD rank above generic single-term matches.
- Generic single-term matches for `Hermes` or `Joplin` SHOULD be downgraded when the query contains multiple terms.
- `Gamdias Hermes` / keyboard-brand matches SHOULD be downgraded for Hermes memory queries, but MUST NOT be hard-denied or removed solely because they are brand matches.

### Rerank prompt

- The rerank prompt MUST keep the output contract as JSON array only.
- The prompt MUST tell the provider to prioritize Hermes wiki engine / Hermes long-term memory system candidates.
- The prompt MUST tell the provider to downgrade generic Joplin tutorials, generic AI assistant articles, and keyboard-brand Hermes candidates unless they directly discuss the Hermes wiki memory system.
- The prompt MUST still include only bounded candidate metadata: query, refs, titles, parent ids, snippets, and keyword scores.

## Verification

- `node --test test/wiki.test.js`
- `spectra validate improve-query-rerank-quality`
- `npm test`
