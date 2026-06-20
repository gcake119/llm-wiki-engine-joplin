## Why

目前 `wiki query` 會在全庫 compiled notes 上做薄關鍵字檢索，當查詢詞同時是品牌、工具名或一般詞時，容易把網頁剪藏、開發測試或 unrelated notes 排到前面。使用者的目標是全庫都可查詢，而不是縮小 notebook 範圍，因此需要讓查詢結果能在保留 source refs 的前提下用語境判斷相關性。

這屬於 information retrieval 的 reranking 問題。成熟做法是先用 deterministic retrieval 找候選，再用 reranker 重新排序候選；本 change 採用 optional local LLM reranker，而不是讓 LLM 直接搜尋全庫或直接回答。

## What Changes

- `wiki query` 新增可選 local LLM rerank 模式，透過 CLI flag 顯式啟用。
- Rerank 模式先沿用現有 keyword retrieval 產生 bounded candidate set，再把候選的 ref、title、parent id、snippet、keyword score 送給本機 LLM 判斷相關性。
- Rerank 輸出仍回傳 source-backed refs；LLM 的 relevance 與 reason 只能作為排序與解釋，不是事實來源。
- LLM provider 預設沿用本機 Ollama 設定與 `WIKI_LLM_MODEL`，provider missing 或 JSON parsing failed 時 fail closed，不能偷偷改回雲端或產生 unsupported answer。
- Foreground query 仍不得呼叫 Joplin Data API、不得觸發 sync/compile、不得建立 draft、不得 approve，也不得寫入 Joplin notes。

## Non-Goals

- 不導入 vector DB、embedding store、hosted RAG service 或新依賴。
- 不把 LLM rerank 設成預設行為；沒有 flag 時維持現有 deterministic query。
- 不讓 LLM 讀全庫全文；只讀 bounded candidates。
- 不讓 LLM 直接回答使用者問題；回答仍必須靠 `wiki read` 或回傳 refs。
- 不新增 notebook allowlist／denylist 作為主要解法，因為使用者明確要全庫可查。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `hermes-wiki-engine`: `wiki query` 增加可選 local LLM rerank 行為，保持全庫查詢、source-backed refs、foreground read-only 與 approve-only writeback 邊界。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - Modified: `src/wiki.js`
  - Modified: `test/wiki.test.js`
  - Modified: `README.md`
  - Modified: `docs/design.md`
  - Modified: `packaging/hermes/skills/wiki/SKILL.md`
  - Removed: none
