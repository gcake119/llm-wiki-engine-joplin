## Context

`wiki query` 目前從 `compiled/notes.json` 做 deterministic lexical ranking。這符合 local-first baseline，但全庫查詢時會遇到同名詞誤命中，例如 `Hermes` 同時可能是專案、工具、鍵盤品牌或剪藏文章文字。

使用者目標是所有 Joplin 筆記都可以被查詢，不是用 notebook allowlist 縮小資料面。這次變更要補的是 information retrieval 裡常見的 reranking layer：第一階段仍用 deterministic query 找候選，第二階段才用本機 LLM 判斷候選與問題的語境相關性。

## Goals / Non-Goals

**Goals:**

- 保留全庫 sync、全庫 compile、全庫 query 的產品方向。
- 新增顯式啟用的 local LLM rerank 模式，改善同名詞與弱關鍵字誤命中。
- 讓 rerank 結果仍是 source-backed refs，並保留 keyword score、LLM relevance 與簡短 reason。
- 沿用既有本機 Ollama provider 與 `WIKI_LLM_MODEL`，不新增套件。
- 保持 foreground query 不觸發 Joplin API、sync、compile、draft、approve 或任何 writeback。

**Non-Goals:**

- 不引入 vector DB、embedding pipeline、hosted RAG service 或 cloud provider。
- 不讓 LLM 掃全庫全文；只處理 bounded candidates。
- 不讓 LLM 直接產生答案或事實內容；LLM 只決定候選排序。
- 不把 LLM rerank 設為預設；沒有 flag 時 query 維持 deterministic behavior。
- 不新增 notebook allowlist／denylist 作為本問題的主要修正。

## Decisions

### Keep deterministic query as the first-stage retriever

第一階段沿用現有 `queryTerms`、`noteScore`、`snippet` 邏輯產生候選。實作時需要把目前直接 `.slice(0, 5)` 的 query pipeline 拆成可重用 helper：先取 bounded candidate list，再依模式輸出 deterministic top results 或 reranked results。

替代方案是直接用 LLM 判斷全庫每篇筆記；不採用，因為成本高、慢、會暴露太多內容給模型，且不符合 foreground query 的可預期性。

### Add explicit local LLM rerank flag

CLI 採用顯式 flag，例如 `wiki query "Hermes 長期記憶" --rerank-llm`。沒有 flag 時輸出、排序與失敗模式維持現狀。Rerank 模式可選擇較大的候選池，例如先取前 20 筆 keyword candidates，再輸出最多 5 筆。

替代方案是讓 query 預設自動 rerank；不採用，因為 foreground query 會突然依賴本機模型可用性，且讓測試與操作成本上升。

### Constrain LLM input and output to source refs

LLM prompt 只包含 query、candidate ref、title、parent id、snippet、keyword score。Prompt 不包含 token、raw env、完整筆記正文、Joplin API URL 或 draft content。LLM 必須輸出 JSON array，每筆只能包含 `ref`、`relevance`、`reason`。實作需 parse JSON，丟棄 unknown refs，將 relevance clamp 到定義範圍，並保留 keyword candidates 作為 source-backed evidence。

替代方案是讓 LLM 產生自然語言解釋或答案；不採用，因為 LLM output 不是事實來源。

### Fail closed when rerank is unavailable

`--rerank-llm` 是使用者顯式要求模型判斷，因此 provider unavailable、timeout、empty output、invalid JSON、沒有可用 rerank rows 時，命令回傳 stable error，例如 `LLM_RERANK_UNAVAILABLE`。它不得靜默降級成 deterministic query，避免 operator 以為結果已經被 LLM 判斷。

沒有 `--rerank-llm` 的 ordinary query 不受影響，仍在 compiled index missing 或 no match 時照既有錯誤與 `資料不足` 行為處理。

## Implementation Contract

Behavior:

- `wiki query "問題"` 維持 deterministic lexical ranking，不呼叫 LLM。
- `wiki query "問題" --rerank-llm` 先從 `compiled/notes.json` 取得 bounded keyword candidates，再呼叫本機 LLM provider rerank。
- Rerank 成功時回傳 JSON：`ok: true`、`state: "reranked"`、`evidence_status: "source_backed"`、`query`、`rerank.provider`、`rerank.model`、`rerank.prompt_version`、`results`。
- 每個 reranked result 保留 `ref`、`kind`、`id`、`title`、`parent_id`、`snippet`、`score`，並新增 `rerank_score` 與 `rerank_reason`。
- Rerank 不得新增、修改或刪除 local draft、automation、semantic、capture、review、Joplin note 或 raw/compiled artifacts。

Interface / data shape:

- CLI flag: `--rerank-llm`。
- Provider injection for tests follows existing dependency style: `run(argv, env, deps)` can receive `llmProvider` or a narrower rerank provider through deps.
- Prompt version string uses a stable value such as `query-rerank-v1`.
- Candidate pool is bounded by a constant or small helper value. A reasonable first value is 20 candidates in, 5 results out.

Failure modes:

- Missing compiled index keeps existing `WIKI_COMPILED_INDEX_MISSING` behavior before rerank starts.
- No keyword candidates keeps existing insufficient-data response; rerank does not call LLM when there are no candidates.
- LLM provider missing, timed out, returned empty output, invalid JSON, or only unknown refs returns `ok: false`, `code: "LLM_RERANK_UNAVAILABLE"`, and a user-safe message.
- Error output must not include raw prompt, full snippets beyond normal query result snippets, stack traces, token values, or env values.

Acceptance criteria:

- `node --test` covers deterministic query unchanged without `--rerank-llm`。
- A test with two weak keyword matches proves `--rerank-llm` can put the semantically relevant ref first.
- A test proves rerank prompt receives only bounded candidate metadata, not full raw note bodies.
- A test proves invalid provider output returns `LLM_RERANK_UNAVAILABLE`.
- A test proves rerank does not create draft、automation、semantic、capture、review or Joplin writeback artifacts.

Scope boundaries:

- In scope: `src/wiki.js` query pipeline, `test/wiki.test.js`, README/design/Hermes skill guidance, delta spec.
- Out of scope: embedding rebuild, semantic index changes, background scheduler, notebook filters, cloud LLM config, Joplin writeback changes, answer generation.

## Risks / Trade-offs

- [Risk] LLM rerank adds latency to foreground query → Mitigation: make it explicit via `--rerank-llm` and keep candidate pool bounded.
- [Risk] LLM returns malformed JSON → Mitigation: parse strictly and fail with `LLM_RERANK_UNAVAILABLE`.
- [Risk] Operator mistakes rerank reason for fact evidence → Mitigation: label output as rerank metadata and keep final evidence source as refs/snippets.
- [Risk] Prompt leaks too much note content → Mitigation: include only title、parent id、snippet、keyword score and bounded candidates.
- [Risk] Existing spec says query does not call LLM → Mitigation: modify that requirement to distinguish default deterministic query from explicit rerank mode.
