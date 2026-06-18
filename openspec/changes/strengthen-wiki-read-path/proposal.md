## Why

目前 `wiki sync` 已能建立 raw body cache，`wiki compile` 與 `wiki query` 也已跑通最小 retrieval 主線，但它仍偏 demo 級：Joplin notes 只抓單頁、query scoring 很薄、compiled output 還缺穩定 source metadata，graph / links 也尚未從資料中產生。

先前採用 RAG 是本機設備尚未升級、無法穩定跑本機 LLM 模型時的效能取捨。現在要接 Hermes，主線改成 LLM Wiki tool-use：先穩定本機 wiki artifacts，再讓 Hermes 透過 search / read / links 使用長期記憶，而不是建立新的 RAG / vector layer。

這個問題屬於成熟的 agent-native knowledge system / retrieval-as-reasoning 強化：先穩定 ingestion，再改善 lexical retrieval，接著提供 search / read / links / sufficiency 的可組合工具，最後才進入 source-backed page synthesis、Error Book、capture draft、approve writeback 與 consolidation。不要把它做成傳統 RAG hidden retriever，也不要讓未審核的 capture 直接寫回 Joplin。

## What Changes

- 在同一個 change 內分期強化 read path：
  - Phase 1：`wiki sync` 支援 Joplin notes pagination，補足 sync 統計與 malformed note failure。
  - Phase 2：`wiki query` 改善 stdlib lexical search，加入 top-N limit、title/body 權重、穩定 snippet 與 source metadata。
  - Phase 3：`wiki compile` 產生最小 graph / links artifact，先只從 notebook parent relation 與 Markdown note links 推出。
  - Phase 4：新增 `wiki read <note-id>`，讓 Hermes 能讀取單頁 note 的本機 compiled/raw 內容，不只停在 search results。
  - Phase 5：新增 `wiki links <note-id>`，讓 Hermes 能從 graph artifact 做最小 link traversal。
  - Phase 6：為 `wiki query` / `wiki read` / `wiki links` 補上 evidence sufficiency protocol，讓 agent 能判斷目前回傳是否 source-backed、insufficient 或 graph-missing。
  - Phase 7：定義 source-backed wiki page model，讓 compiled wiki 從 normalized notes 逐步演進成 topic/entity pages，但每個 page 都必須保留 source note references。
  - Phase 8：讓 `wiki compile` 可以產生最小 synthesized page artifacts 與 page index；仍不直接寫 Joplin。
  - Phase 9：讓 `wiki query` / `wiki read` / `wiki links` 支援 page 與 source note 兩種 reference，形成 Hermes 可組合的 wiki traversal 語意。
  - Phase 10：加入 deterministic `wiki audit` / Error Book，先記 structural errors、missing links、unsupported page claims 與 evidence gaps。
  - Phase 11：把 Telegram / Discord / feedback / consolidation 都收斂成 `wiki draft ...` filesystem drafts。
  - Phase 12：讓 `wiki approve <draft-id>` 成為唯一 Joplin writeback 入口，並要求 provenance、conflict check 與 explicit approval。
- 保持 Node stdlib first，不新增 dependency。
- 保持 foreground `wiki query` / `wiki read` / `wiki links` 只讀本機 compiled artifacts，不呼叫 Joplin Data API。
- 保持 Hermes 使用本機 wiki tools；RAG / vector retrieval 不作為本 repo 的預設架構。

## Non-Goals

- 不新增 RAG layer、embedding、vector DB、LLM summary、OCR 或 graph 推理。
- 不讓未審核的 page synthesis、capture、feedback 或 consolidation 直接寫回 Joplin。
- 不讓 Telegram / Discord capture 繞過 filesystem draft 與人工 approve。
- 不讓 `wiki query` / `wiki read` / `wiki links` 在 foreground 呼叫 Joplin、LLM、embedding service 或外部 API。
- 不新增 daemon、queue、HTTP server 或 LaunchDaemon。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: 強化 Joplin raw sync、compiled source metadata、lexical query 與最小 graph/link artifact。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - Modified: src/wiki.js, test/wiki.test.js
  - New: none
  - Removed: none
