## 1. 乾淨 workspace 與 CLI 骨架

- [ ] 1.1 依照 Use a new clean workspace for the engine 決策，建立 `/Users/caiyijun/project/hermes-wiki-engine` 並搬入最小骨架；完成後以 `find . -maxdepth 4 -type f | sort` 確認只包含 README、design、package metadata、CLI、tests、Hermes skill 草案與 Spectra handoff 文件。
- [ ] 1.2 實作 Wiki command bridge exposes stable commands：`wiki` 無支援命令時輸出包含 `status`、`sync`、`compile`、`query`、`draft`、`approve` 的 help；以 `npm test` 與 `node src/wiki.js unknown-command` 驗證。
- [ ] 1.3 實作 Keep wiki as a small command bridge 決策：`compile`、`query`、`draft`、`approve` 在第一 slice 回傳 stable not-yet-implemented JSON，不啟動背景 job；以 Node built-in test 驗證每個命令的 `state` 或 `code` 穩定。

## 2. 狀態檔與 lock 行為

- [ ] 2.1 實作 Status reports current knowledge engine state：沒有 `status.json` 時 `wiki status` 回傳 `ok: true`、`state: "new"` 與 user-safe message；以 Node built-in test 驗證 fresh state 內容。
- [ ] 2.2 實作既有 `status.json` 讀取：`wiki status` 需回傳 persisted status JSON，不需要 Joplin、Telegram、Discord 或模型服務；以 temp directory 測試驗證。
- [ ] 2.3 實作 Use lock file plus status JSON before queue infrastructure 與 Jobs use a single lock and observable status：`wiki sync` 遇到 lock file 時回傳 `ok: false`、`code: "WIKI_BUSY"` 且不啟動 sync；以 temp directory 測試 lock busy 行為。
- [ ] 2.4 實作 sync 成功後 status contract：成功路徑寫入 `status.json`，包含 `ok`、`state`、`last_job`、`started_at`、`finished_at`、`notes_seen`、`warnings`；以 mocked Joplin API 測試驗證欄位。

## 3. Joplin Data API sync preflight

- [ ] 3.1 實作 Use Joplin Data API as the integration boundary 決策：`wiki sync` 僅透過 Joplin Data API preflight，不讀 Joplin SQLite 或 profile path；以 code review 檢查沒有主使用者 Joplin profile path 依賴，並以 Node test 驗證 API client 被呼叫。
- [ ] 3.2 實作 Sync uses Joplin Data API preflight 的 missing-token 失敗：缺 Joplin token 時回傳 stable missing-token code，輸出不得包含 token 或 secret env 內容；以 Node built-in test 驗證錯誤 JSON。
- [ ] 3.3 實作 Joplin API unreachable 失敗：Data API endpoint 無法連線時回傳 stable unavailable-api code 與 user-safe message；以 mocked fetch rejection 測試驗證。
- [ ] 3.4 實作 raw metadata cache：Data API 成功時只保存 note id、title、parent id、updated time、body hash，不保存完整 note body；以 fixture notes 測試輸出的 raw cache schema。

## 4. 前台 retrieval 與 capture 邊界

- [ ] 4.1 實作 Split background ingestion from foreground retrieval 決策：`wiki query` 缺問題時回傳要求補問題的 user-facing message，有問題但 retrieval 未實作時回傳 stable not-yet-implemented JSON，不觸發 sync 或 compile；以 Node built-in test 驗證。
- [ ] 4.2 實作 Foreground query reads completed local memory 的第一 slice contract：query command 不呼叫 Joplin Data API、不建立 lock、不寫 status；以 mocked dependency test 或 code review checklist 驗證。
- [ ] 4.3 實作 Capture sources write drafts before Joplin writeback 的第一 slice contract：`wiki draft telegram`、`wiki draft discord`、`wiki approve <draft-id>` 回傳 stable not-yet-implemented JSON 且不寫 Joplin；以 Node built-in test 驗證。

## 5. 驗證與交付

- [ ] 5.1 執行 `npm test`，確認 CLI parse、status、sync preflight、lock busy、raw cache、query boundary、draft / approve boundary 測試全部通過。
- [ ] 5.2 執行手動 smoke：`node src/wiki.js status`、`node src/wiki.js sync`、`node src/wiki.js query`、`node src/wiki.js draft telegram`，確認輸出皆為 user-safe JSON 或 user-safe message，且沒有 secret 值。
- [ ] 5.3 檢查 artifacts 與 scope：確認第一 slice 未實作 Telegram API、Discord API、Joplin writeback、graph compile、LaunchDaemon 安裝；以 `git status --short` 與 code review 摘要回報。
