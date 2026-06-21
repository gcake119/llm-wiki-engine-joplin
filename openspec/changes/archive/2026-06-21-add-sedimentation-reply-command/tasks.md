## 1. CLI Guard 行為

- [x] 1.1 實作 Sedimentation reply command gates user-facing persistence claims 的 draft success stdin 行為，讓 `wiki sedimentation reply` 輸出 `state: "draft_created"`、`draft_id` 與尚未寫入 Joplin 的 message；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.2 實作 Expose sedimentation reply as a CLI guard 與 Return JSON instead of plain text，讓 approve success stdin 輸出 `state: "approved"`、`joplin_note_id` 與 Joplin writeback proof；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.3 實作 `wiki sedimentation reply --suggested`，讓無 proof 情境只能輸出建議建立待審草稿，不宣稱保存；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.4 實作 Read tool result from stdin by default 的 fail-closed 行為，讓 empty stdin、invalid JSON、`ok:false`、missing proof fields 都輸出 `state: "failed"` 且不含成功語氣或 runtime diagnostics；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.5 確認 Reply command remains read-only，讓 `wiki sedimentation reply` 不需要 `WIKI_STATE_DIR` 或 `WIKI_JOPLIN_TOKEN`，也不建立任何 raw、compiled、draft、review、capture、automation、audit artifact；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.6 實作 Capture ingestion proof handling，讓 `capture_ingested`、`accepted > 0` 且 `drafts[0].draft_id` 的 capture 結果輸出 `draft_created`，而 `accepted: 0` 或缺少 accepted draft id 時維持 fail-closed；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.7 實作 Draft review command bridge，讓 `wiki draft show <draft-id>` 讀取 review-gated draft JSON 並輸出 `draft_loaded`、content、provenance 與 intended target，`--message-only` 只輸出草稿全文，未知或 unsafe draft id 回 `DRAFT_NOT_FOUND`；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.8 實作 Store then resolve reply targets 的 message-store resolver bridge，讓 `wiki message store telegram --input <path>` 儲存完整 inbound user message 與 outbound bot response，`wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>` 回傳 capture-compatible full event，missing target 與 empty text fail-closed；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.9 實作 Bound message-store retention guard，讓 `WIKI_MESSAGE_STORE_TTL_DAYS` 控制 resolver cache TTL、`WIKI_MESSAGE_STORE_MAX_TEXT_BYTES` 拒絕 oversized entries、`wiki message prune [telegram|discord]` 清理過期 cache，且 expired resolve fail-closed；用 `node --test test/wiki.test.js` 驗證。

## 2. Hermes／Telegram 指引

- [x] 2.1 更新 Hermes skill guidance，要求 Telegram／Hermes 沉澱成功回覆先呼叫 `wiki sedimentation reply` 或等效 proof gate，並提供 stdin pipe 範例；用內容測試確認 `packaging/hermes/skills/wiki/SKILL.md` 包含命令與三種 proof states。
- [x] 2.2 更新 README 與 docs/design.md，讓 operator 可用 CLI 驗證 live runtime 的 draft success、approve success、empty tool failure，不再需要 import pnpm global source path；用內容測試確認三種範例存在。
- [x] 2.3 實作 Support message-only handoff for chat adapters：新增 `wiki sedimentation reply --message-only`，讓 Telegram／Hermes 對話層可直接把 stdout 當成 outgoing message，且 draft success 與 empty stdin 都維持 proof-gated／fail-closed；用 `node --test test/wiki.test.js` 驗證。
- [x] 2.4 更新 Hermes skill guidance、README 與 docs/design.md，要求 chat adapter 若不解析 JSON，就使用 `--message-only`，不得自行改寫成功語氣；用內容測試確認 message-only 指令與限制存在。
- [x] 2.5 實作 Keep user language natural：更新自然語言沉澱規則，要求 Telegram／Hermes 使用者只需說「這段值得沉澱」或「整理成待審草稿」即可觸發 review-gated draft flow，不需說出 command、JSON pipe、路徑或 proof gate；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.6 記錄 live Telegram capture allowlist 前提，要求 runtime env 使用 `export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=<source-id-list>`，避免 `wiki capture telegram` 子程序因讀不到 allowlist 而回 `CAPTURE_SOURCE_NOT_ALLOWED`；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.7 更新 README、docs/design.md 與 Hermes skill，要求「給我看 draft-... 的全文」等自然語言審閱要求路由到 `wiki draft show <draft-id> --message-only`，不得搜尋任意 `/Users/hermes` 路徑或要求使用者提供 filesystem location；用內容測試確認規則存在。
- [x] 2.8 更新自然語言沉澱語境規則，要求 Telegram reply request 使用 `reply_to_text` 作為 capture content，command-only request 必須請使用者指定 target，不得把指令本身建立成 draft；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.9 收緊 reply-context 完整性規則，要求 adapter 只能使用完整 `reply_to_text`，不得用 preview、log-truncated snippet、UI summary 或明顯截斷片段建立部分草稿；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.10 更新 reply-context 解析來源規則，要求 adapter 以 `reply_to_id` 到 Hermes session／message store 或 Telegram message cache 取得完整原訊息，並把 `reply_to_text` 視為 preview only；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.11 加入 reply-context capture 重新開啟 gate，要求 gateway 在 verified `reply_to_id -> full stored original message` resolver 與 runtime draft-content equality test 完成前維持 fail-closed，不得把 `reply_to_text` preview 送進 `wiki capture`；用內容測試確認 README、docs/design.md、Hermes skill 都包含此規則。
- [x] 2.12 更新 README、docs/design.md 與 Hermes skill，要求 gateway 每則 inbound user message 與 outbound bot response 都先呼叫 `wiki message store`，reply-context 沉澱時先呼叫 `wiki message resolve`，resolve 成功才進 `wiki capture`，resolve 失敗不得 fallback 到 `reply_to_text`；用內容測試確認規則存在。
- [x] 2.13 更新 README、docs/design.md、Hermes skill 與 `.env.example`，記錄 message store 是 bounded resolver cache，預設 TTL 14 天、單則 128KB、可用 `wiki message prune` 清理，且 pruning 不刪除 drafts／review／capture／Joplin；用內容測試確認規則存在。

## 3. 驗證與收斂

- [x] 3.1 執行 `node --test test/wiki.test.js`，確認 CLI guard、既有 formatter 與 wiki CLI 行為都通過。
- [x] 3.2 執行 `spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 change artifacts 乾淨。
- [x] 3.3 檢查本 change 仍符合 DEC-0001／ADR-0001：新增命令只格式化回覆，不建立 draft、不 approve、不寫回 Joplin；用 `git diff --stat` 與人工 review 確認 scope。
- [x] 3.4 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認新增 message-only handoff 仍符合同一 change。
- [x] 3.5 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認自然語言沉澱規則仍符合同一 change。
- [x] 3.6 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 capture success proof 與 allowlist export 文件已納入同一 change。
- [x] 3.7 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 draft show 審閱路由納入同一 change。
- [x] 3.8 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 reply-context sedimentation 語境規則納入同一 change。
- [x] 3.9 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 truncated reply-context fail-closed 規則納入同一 change。
- [x] 3.10 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 `reply_to_id` 解析完整原訊息規則納入同一 change。
- [x] 3.11 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 reply-context capture 重新開啟 gate 納入同一 change。
- [x] 3.12 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 message-store resolver bridge 納入同一 change。
- [x] 3.13 重新執行 `node --test test/wiki.test.js`、`spectra validate add-sedimentation-reply-command` 與 `spectra analyze add-sedimentation-reply-command --json`，確認 Bound message-store retention guard 納入同一 change。
