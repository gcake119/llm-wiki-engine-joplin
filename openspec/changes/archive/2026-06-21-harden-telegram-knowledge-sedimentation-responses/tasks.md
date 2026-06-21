## 1. 回覆契約與測試

- [x] 1.1 實作 Knowledge sedimentation replies are tool-result gated 的狀態分類契約，讓 suggested、draft_created、approved、failed 四種狀態都只能根據工具結果輸出；用 `node --test test/wiki.test.js` 驗證 draft 成功、approve 成功與 missing proof cases。
- [x] 1.2 落實 Use an explicit sedimentation response contract，讓成功文案必須分辨建議沉澱、待審草稿與 Joplin 寫回；用單元測試斷言 suggested 狀態不得包含「已寫入 Joplin」或「已收進筆記庫」語意。
- [x] 1.3 落實 Keep writeback proof stricter than draft proof，讓 `draft_id` 只能產生待審草稿回覆、`joplin_note_id` 才能產生已寫回 Joplin 回覆；用單元測試檢查兩種 proof 的輸出差異。
- [x] 1.4 落實 Treat empty tool responses as failed, not successful，讓 empty response、不可解析 JSON、缺少 `draft_id` 或缺少 `joplin_note_id` 時都 fail closed；用單元測試確認不會重用成功訊息，也不輸出 runtime fallback diagnostics。

## 2. Hermes／Telegram 操作指引

- [x] 2.1 更新 Hermes skill guidance，讓 Telegram capture replies preserve approve-only writeback：Telegram 來源只能先建立 reviewable filesystem draft，正式寫回必須等 `wiki approve` 回傳 `joplin_note_id`；用內容檢查確認 `packaging/hermes/skills/wiki/SKILL.md` 包含 draft-only 與 approve-proof 規則。
- [x] 2.2 補強 README 與 design 文件，讓 operator 了解 Telegram 自然語言沉澱的安全回覆模式，並明確排除 Telegram bot adapter 實作；用人工內容檢查確認文件列出 draft success、approve success、empty tool failure 三種回覆範例。
- [x] 2.3 落實 Keep the implementation small and local，避免新增 Telegram transport、常駐服務或外部 dependency；用 `git diff --stat` 與 `package.json` 檢查確認 scope 僅限 helper、tests、docs、skill guidance。

## 3. 驗證與規格收斂

- [x] 3.1 執行 `node --test test/wiki.test.js`，確認回覆契約與既有 wiki CLI 行為都通過。
- [x] 3.2 執行 `spectra validate harden-telegram-knowledge-sedimentation-responses`，確認 proposal、design、spec、tasks 互相對齊。
- [x] 3.3 檢查本 change 是否仍符合 DEC-0001／ADR-0001 的 Joplin SSOT 與 approve-only writeback；用人工 review 確認沒有任何非 approve 流程宣稱 Joplin writeback。
