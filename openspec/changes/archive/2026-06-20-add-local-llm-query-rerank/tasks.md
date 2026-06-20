## 1. 測試先行

- [x] 1.1 為 `Query ranks lexical matches deterministically` 補回歸測試：沒有 `--rerank-llm` 時 `wiki query` 不呼叫 LLM provider，仍依 title/body keyword score 排序；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.2 為 `Query can rerank bounded candidates with local LLM` 補成功案例測試：兩筆 keyword candidates 都命中 `Hermes` 時，`--rerank-llm` 依 provider 回傳 relevance 把真正的 Hermes memory ref 排到鍵盤文章前面；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.3 為 `Constrain LLM input and output to source refs` 補 prompt 邊界測試：provider 只能收到 query、bounded candidate refs、title、parent id、snippet、keyword score，不收到 full raw note body、env dump、token 或 draft content；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.4 為 `Fail closed when rerank is unavailable` 補失敗測試：provider missing、invalid JSON 或 unknown refs 時回傳 `LLM_RERANK_UNAVAILABLE`，且不靜默改回 deterministic rerank result；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.5 為 `Hermes uses local wiki tools instead of RAG` 補 read-only 測試：`wiki query --rerank-llm` 不建立 draft、automation、semantic、capture、review、raw、compiled 或 Joplin writeback artifact；用 `node --test test/wiki.test.js` 驗證。

## 2. 查詢管線實作

- [x] 2.1 實作 `Keep deterministic query as the first-stage retriever`：把 `src/wiki.js` 既有 query ranking 拆成 bounded candidate helper，讓普通 query 繼續輸出前 5 筆 deterministic results，並讓 rerank 模式可取得前 20 筆 candidates；用 1.1 測試驗證。
- [x] 2.2 實作 `Add explicit local LLM rerank flag`：讓 `run(["query", ..., "--rerank-llm"])` 解析 flag，普通 query 不受影響，rerank mode 才呼叫 provider；用 1.1 與 1.2 測試驗證。
- [x] 2.3 實作 `Constrain LLM input and output to source refs`：新增 query rerank prompt、strict JSON parser、known-ref filtering、relevance clamp，成功輸出 `state: "reranked"`、`rerank` metadata、`rerank_score`、`rerank_reason`；用 1.2 與 1.3 測試驗證。
- [x] 2.4 實作 `Fail closed when rerank is unavailable`：provider exception、empty output、invalid JSON、unknown refs 都回傳 user-safe `LLM_RERANK_UNAVAILABLE`，且錯誤不包含 prompt、stack、token 或 full note body；用 1.4 測試驗證。
- [x] 2.5 保持 `Query can rerank bounded candidates with local LLM` 的 foreground read-only 邊界：rerank 只讀 `compiled/notes.json` 且不寫 artifacts、不呼叫 Joplin Data API、不觸發 sync/compile/draft/approve；用 1.5 測試驗證。

## 3. 文件與操作指引

- [x] 3.1 更新 `README.md` 的 Commands 與 query 說明：明確列出 `wiki query "問題" --rerank-llm`，說明它是 optional local LLM reranker、不是答案來源、失敗時會 fail closed；用人工閱讀與 `rg -n "--rerank-llm|LLM rerank" README.md` 驗證。
- [x] 3.2 更新 `docs/design.md`：補上 local LLM rerank 的 pipeline、bounded candidate input、source refs output、非預設行為與 non-goals；用人工閱讀與 `rg -n "rerank|query-rerank" docs/design.md` 驗證。
- [x] 3.3 更新 `packaging/hermes/skills/wiki/SKILL.md`：指示 Hermes 只有在 operator 需要語境重排時才使用 `--rerank-llm`，且 rerank reason 不能當作事實來源；用人工閱讀與 `rg -n "--rerank-llm|rerank" packaging/hermes/skills/wiki/SKILL.md` 驗證。

## 4. 最終驗證

- [x] 4.1 跑完整測試確認所有 query、semantic、draft、approve 邊界仍成立；用 `npm test` 驗證。
- [x] 4.2 跑 Spectra 驗證確認 `add-local-llm-query-rerank` artifacts 與 delta spec 可套用；用 `spectra validate add-local-llm-query-rerank` 驗證。
- [x] 4.3 手動檢查 `Query ranks lexical matches deterministically`、`Hermes uses local wiki tools instead of RAG`、`Query can rerank bounded candidates with local LLM` 三個 requirement 都有對應測試與文件；用 `rg -n "Query ranks lexical|Hermes uses local wiki tools|Query can rerank" openspec/changes/add-local-llm-query-rerank test/wiki.test.js README.md docs/design.md packaging/hermes/skills/wiki/SKILL.md` 驗證。
