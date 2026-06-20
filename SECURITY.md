# Security

Hermes Wiki Engine 是本機 CLI。它不提供雲端服務、帳號系統、多使用者隔離、sandboxing、hosted bot runtime 或 security SLA。

## Trust Boundaries

- Joplin 是長期知識庫 SSOT。
- Joplin 整合只走 Joplin Data API。
- 本專案不得直接讀寫 Joplin SQLite、profile 或跨使用者檔案。
- `wiki approve <draft-id>` 是唯一正式 Joplin writeback gate。
- `wiki sync`、`wiki compile`、`wiki query`、`wiki read`、`wiki links`、`wiki audit`、candidate discovery、automation、capture、draft creation 都不得寫入 Joplin notes。

## Secrets

這些值只能放在本機環境設定或等價的 local secret 管理中：

- `WIKI_JOPLIN_TOKEN`
- `DISCORD_SYSTEM_WEBHOOK_URL`
- `WIKI_CAPTURE_TELEGRAM_ALLOWLIST`
- `WIKI_CAPTURE_DISCORD_ALLOWLIST`

不要提交：

- `.env` 或其他 local env 檔。
- state directory。
- raw cache。
- generated drafts。
- webhook URL。
- Joplin token。

`.env.example` 只提供 placeholder。不要把真實 token 或 webhook URL 寫進範例。

## Reporting

公開 repo：`https://github.com/gcake119/llm-wiki-engine-joplin`

若發現漏洞，請先開 GitHub issue，避免貼出真實 token、webhook URL、個人筆記內容或 raw cache。
