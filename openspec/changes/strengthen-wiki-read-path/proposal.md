## Why

目前 `wiki sync` 已能建立 raw body cache，`wiki compile` 與 `wiki query` 也已跑通最小 retrieval 主線，但它仍偏 demo 級：Joplin notes 只抓單頁、query scoring 很薄、compiled output 還缺穩定 source metadata，graph / links 也尚未從資料中產生。

先前採用 RAG 是本機設備尚未升級、無法穩定跑本機 LLM 模型時的效能取捨。現在要接 Hermes，主線改成 LLM Wiki tool-use：先穩定本機 wiki artifacts，再讓 Hermes 透過 search / read / links 使用長期記憶，而不是建立新的 RAG / vector layer。

這個問題屬於成熟的 retrieval pipeline 強化：先穩定 ingestion，再改善 lexical retrieval，最後才建立 link graph。不要在 read path 尚未穩定時引入 Telegram、Discord、Joplin writeback、RAG、embedding 或 vector DB。

## What Changes

- 在同一個 change 內分期強化 read path：
  - Phase 1：`wiki sync` 支援 Joplin notes pagination，補足 sync 統計與 malformed note failure。
  - Phase 2：`wiki query` 改善 stdlib lexical search，加入 top-N limit、title/body 權重、穩定 snippet 與 source metadata。
  - Phase 3：`wiki compile` 產生最小 graph / links artifact，先只從 notebook parent relation 與 Markdown note links 推出。
  - Phase 4：新增 `wiki read <note-id>`，讓 Hermes 能讀取單頁 note 的本機 compiled/raw 內容，不只停在 search results。
  - Phase 5：新增 `wiki links <note-id>`，讓 Hermes 能從 graph artifact 做最小 link traversal。
  - Phase 6：為 `wiki query` / `wiki read` / `wiki links` 補上 evidence sufficiency protocol，讓 agent 能判斷目前回傳是否 source-backed、insufficient 或 graph-missing。
  - Phase 7：明確保留 page synthesis、self-evolving loop、capture / writeback deferred boundary，不在本 change 實作 topic/entity wiki page、Error Book、feedback、consolidation、Telegram、Discord、`wiki approve` 或 Joplin writeback。
- 保持 Node stdlib first，不新增 dependency。
- 保持 foreground `wiki query` 只讀本機 compiled artifacts，不呼叫 Joplin Data API。
- 保持 Hermes 使用本機 wiki tools；RAG / vector retrieval 不作為本 repo 的預設架構。

## Non-Goals

- 不新增 RAG layer、embedding、vector DB、LLM summary、OCR 或 graph 推理。
- 不實作 topic/entity wiki page synthesis。
- 不實作 self-evolving memory loop、Error Book、feedback 或 consolidation。
- 不實作 Telegram / Discord capture。
- 不實作 Joplin writeback 或 `wiki approve`。
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
