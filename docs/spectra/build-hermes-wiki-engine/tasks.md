## 1. Phase 1：CLI 骨架與 metadata sync（已完成）

- [x] 1.1 依照 Use a new clean workspace for the engine 決策，建立 `/Users/caiyijun/project/hermes-wiki-engine` 並搬入最小骨架。
- [x] 1.2 實作 Wiki command bridge exposes stable commands：`wiki` 無支援命令時輸出包含 `status`、`sync`、`compile`、`query`、`draft`、`approve` 的 help。
- [x] 1.3 實作 Keep wiki as a small command bridge 決策：`compile`、`query`、`draft`、`approve` 回傳 stable not-yet-implemented JSON，不啟動背景 job。
- [x] 1.4 實作 Status reports current knowledge engine state：沒有 `status.json` 時 `wiki status` 回傳 `ok: true`、`state: "new"` 與 user-safe message。
- [x] 1.5 實作既有 `status.json` 讀取：`wiki status` 回傳 persisted status JSON，不需要 Joplin、Telegram、Discord 或模型服務。
- [x] 1.6 實作 Use lock file plus status JSON before queue infrastructure：`wiki sync` 遇到 lock file 時回傳 `ok: false`、`code: "WIKI_BUSY"` 且不啟動 sync。
- [x] 1.7 實作 Joplin Data API preflight：缺 token、API unreachable、state directory unavailable 都回傳 stable user-safe JSON，且不輸出 secret。
- [x] 1.8 實作 raw metadata cache：Data API 成功時只保存 note id、title、parent id、updated time、body hash，不保存完整 note body。
- [x] 1.9 以 Node built-in test 覆蓋 parse、status、sync preflight、lock busy、raw metadata cache、query boundary、draft / approve boundary。

## 2. Phase 2：raw body cache

- [ ] 2.1 延伸 `wiki sync`：仍只透過 Joplin Data API 抓 note body，不讀 Joplin SQLite 或 profile path。
- [ ] 2.2 寫入 `raw/notes/<note-id>.md`：每筆 synced note 都有獨立 body file。
- [ ] 2.3 保持 `raw/notes-metadata.json` 為 compact manifest：只保存 `id`、`title`、`parent_id`、`updated_time`、`body_hash`，不重複完整 body。
- [ ] 2.4 確認 body hash 由實際 body 計算，重跑 sync 對相同 body 產生穩定 hash。
- [ ] 2.5 測試 token-safe failure、body file 寫入、metadata 不含完整 body、lock cleanup。
- [ ] 2.6 確認本 phase 不實作 `compile`、`query`、Telegram、Discord、Joplin writeback、LaunchDaemon。

## 3. Phase 3：thin compile

- [ ] 3.1 實作 `wiki compile` 只讀 `raw/notes-metadata.json` 與 `raw/notes/*.md`，不呼叫 Joplin Data API。
- [ ] 3.2 缺 raw cache 時回傳 stable user-safe error，不建立空 compiled index 假裝成功。
- [ ] 3.3 產出 `compiled/notes.json`，每筆包含 `id`、`title`、`parent_id`、`updated_time`、`body_hash`、`plain_text`。
- [ ] 3.4 `plain_text` 先用本機最小 Markdown 清理，不新增 dependency，不做 LLM summary、embedding、graph、tags、backlinks。
- [ ] 3.5 成功 compile 後更新 `status.json`，記錄 `last_job: "compile"`、時間、notes compiled、warnings。
- [ ] 3.6 以 Node built-in test 驗證 deterministic output、missing raw error、compile 不碰 Joplin、status update。

## 4. Phase 4：thin query

- [ ] 4.1 實作 `wiki query "問題"` 只讀 `compiled/notes.json`，不呼叫 Joplin Data API、不建立 lock、不寫 raw cache。
- [ ] 4.2 使用 Node stdlib 做最小 keyword search；先以 title + plain_text 命中與簡單 score 排序。
- [ ] 4.3 回傳 source-backed JSON：note id、title、snippet、score。
- [ ] 4.4 找不到結果時回傳 user-facing `資料不足`，不得編造答案。
- [ ] 4.5 缺 compiled index 時回傳 stable user-safe error，提示先跑 `wiki compile`。
- [ ] 4.6 以 Node built-in test 驗證查詢命中、無命中、缺 index、query 不碰 Joplin。

## 5. Deferred surfaces

- [ ] 5.1 Telegram capture 延後：等 retrieval 主線穩定後，才實作 `wiki draft telegram ...`。
- [ ] 5.2 Discord capture 延後：第一版仍限定個人伺服器與 allowlisted channel，但不在 retrieval change 內實作。
- [ ] 5.3 Joplin writeback / `wiki approve` 延後：這是寫入正式知識庫的高風險面，需另行確認 inbox notebook 與人工 approve contract。
- [ ] 5.4 LaunchDaemon / Hermes runtime install 延後：先讓手動 CLI 穩定，再包背景化。
- [ ] 5.5 Graph、embedding、vector DB、LLM summary、附件 OCR 延後：等 `raw -> compiled -> query` 跑通後再評估。

## 6. Verification

- [ ] 6.1 每個 phase 完成後執行 `npm test`。
- [ ] 6.2 每個 phase 完成後執行對應手動 smoke：`node src/wiki.js status`、`sync`、`compile`、`query`。
- [ ] 6.3 每個 phase 完成後檢查 `git status --short`，確認沒有意外 runtime cache、secret 或 generated local state 進版控。
