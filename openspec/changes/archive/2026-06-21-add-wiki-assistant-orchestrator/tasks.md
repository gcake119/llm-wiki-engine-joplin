## 1. Assistant Route CLI Contract

- [x] 1.1 實作 `Assistant route produces deterministic wiki action plans` 的 `wiki assistant route --input <path>` parser 與 invalid input fail-closed contract，讓 missing input 與 invalid JSON 回 `ASSISTANT_INPUT_MISSING`／`ASSISTANT_INPUT_INVALID` 且不輸出 stack trace；用 `node --test test/wiki.test.js` 驗證。
- [x] 1.2 實作 `Introduce an engine-owned assistant route command` 與 `Return action plans instead of executing every side effect` 的 no-action pass-through，讓非 wiki 意圖回 `state: "no_action"` 且沒有 capture payload；用 `node --test test/wiki.test.js` 驗證。

## 2. Reply 與 Capture Orchestration

- [x] 2.1 實作 `Assistant route keeps reply-context sedimentation proof-gated` 與 `Treat reply_to_text as preview-only metadata` 的 unresolved reply fail-closed 行為，讓含 `reply_to_id` 但缺 `resolved_event.text` 的沉澱要求回 `ASSISTANT_REPLY_TARGET_UNRESOLVED` 且不輸出 capture payload；用 `node --test test/wiki.test.js` 驗證。
- [x] 2.2 實作 resolved reply capture action plan，讓含 `reply_to_id` 與完整 `resolved_event.text` 的沉澱要求回 `action: "capture_from_resolved_message"`，且 `capture_input.events[0].text` 等於 full resolved text、不是 `reply_to_text` 或使用者指令；用 `node --test test/wiki.test.js` 驗證 spec example。
- [x] 2.3 實作 `Assistant route separates command-only and inline capture requests` 與 `Keep inline body capture explicit`，讓 command-only 沉澱回 `ASSISTANT_CAPTURE_TARGET_REQUIRED`，而「整理成待審草稿：正文」回 `action: "capture_inline_body"` 與正文 payload；用 `node --test test/wiki.test.js` 驗證。

## 3. Draft Review 與 Proof Message 邊界

- [x] 3.1 實作 `Assistant route sends draft review to the draft show bridge`，讓「給我看 draft-... 的全文」回 `action: "show_draft"` 與 `wiki draft show <draft-id> --message-only` command array，unsafe draft id 回 `ASSISTANT_DRAFT_ID_INVALID` 且不輸出 filesystem search；用 `node --test test/wiki.test.js` 驗證。
- [x] 3.2 實作 `Keep proof messages centralized` 文件與 guidance，讓 README、docs/design.md、Hermes skill 都要求 Telegram／Hermes adapter 先呼叫 `wiki assistant route`，再依 action 執行 `wiki message resolve`、`wiki capture`、`wiki draft show`、`wiki sedimentation reply --message-only`；用內容測試或人工內容檢查搭配 `node --test test/wiki.test.js` 驗證。

## 4. 驗證與收斂

- [x] 4.1 執行 `node --test test/wiki.test.js`，確認 assistant route、既有 sedimentation reply、message store/resolve、draft show 與 capture 行為全部通過。
- [x] 4.2 執行 `spectra validate add-wiki-assistant-orchestrator` 與 `spectra analyze add-wiki-assistant-orchestrator --json`，確認新 change artifacts 與實作契約一致，且沒有 Critical 或 Warning findings。
