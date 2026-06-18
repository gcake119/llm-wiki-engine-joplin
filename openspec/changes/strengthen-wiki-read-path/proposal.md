## Why

目前 `wiki sync` 已能建立 raw body cache，`wiki compile` 與 `wiki query` 也已跑通最小 retrieval 主線，但它仍偏 demo 級：Joplin notes 只抓單頁、query scoring 很薄、compiled output 還缺穩定 source metadata，graph / links 也尚未從資料中產生。

這個問題屬於成熟的 retrieval pipeline 強化：先穩定 ingestion，再改善 lexical retrieval，最後才建立 link graph。不要在 read path 尚未穩定時引入 Telegram、Discord、Joplin writeback、embedding 或 vector DB。

## What Changes

- 在同一個 change 內分期強化 read path：
  - Phase 1：`wiki sync` 支援 Joplin notes pagination，補足 sync 統計與 malformed note failure。
  - Phase 2：`wiki query` 改善 stdlib lexical search，加入 top-N limit、title/body 權重、穩定 snippet 與 source metadata。
  - Phase 3：`wiki compile` 產生最小 graph / links artifact，先只從 notebook parent relation 與 Markdown note links 推出。
  - Phase 4：明確保留 capture / writeback deferred boundary，不在本 change 實作 Telegram、Discord、`wiki approve` 或 Joplin writeback。
- 保持 Node stdlib first，不新增 dependency。
- 保持 foreground `wiki query` 只讀本機 compiled artifacts，不呼叫 Joplin Data API。

## Non-Goals

- 不新增 embedding、vector DB、LLM summary、OCR 或 graph 推理。
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
