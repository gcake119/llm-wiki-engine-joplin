## 1. Project Contract Documentation

- [x] 1.1 交付 `Telegram tool router calls wiki command bridge deterministically` 的 README 說明：記錄 `/wiki` and `wiki` routes 由外部 Telegram adapter 呼叫本機 `wiki` CLI，並以 content review 驗證。
- [x] 1.2 交付 `Telegram adapters forward wiki stdout without re-authoring` 的 README 說明：記錄 stdout handoff、`wiki sedimentation reply --message-only` 與一般 wiki stdout 直回 Telegram，不經 LLM 重寫，並以 content review 驗證。
- [x] 1.3 交付 `Telegram router ownership stays outside wiki engine runtime` 的 README 說明：記錄 ownership boundary、wiki-engine 不擁有 Telegram polling，一般聊天 fallback 屬於外部 gateway，並以 content review 驗證。

## 2. Verification

- [x] 2.1 執行 `spectra analyze document-telegram-tool-router-contract --json`，確認沒有 Critical findings。
- [x] 2.2 執行 `spectra instructions apply --change document-telegram-tool-router-contract --json`，確認 tasks all_done。
