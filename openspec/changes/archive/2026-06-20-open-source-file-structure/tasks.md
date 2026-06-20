## 1. Package Metadata And Publish Shape

- [x] 1.1 實作 Open-source package metadata is complete 與 Use boring npm CLI packaging as the public boundary：`package.json` 對外描述 CLI purpose、license、repository URL `https://github.com/gcake119/llm-wiki-engine-joplin`、keywords、Node engine、bin、test script，且不再只因 `private: true` 阻止本機 packaging；以 `node --test` 中的 package metadata assertion 或等價 node:test 覆蓋 repository、bin、engine、private blocker 驗證。
- [x] 1.2 實作 local package dry-run exclusion contract：package publish list 排除 local state、secret env、raw cache、generated runtime artifacts 與 token-bearing files，並保留 CLI source、docs、tests、specs、Hermes packaging guidance；以 `npm pack --dry-run` 輸出與內容審查驗證。

## 2. Portable Open-Source Documentation

- [x] [P] 2.1 實作 Open-source documentation defines a portable install path 與 Make portable defaults explicit and keep Hermes runtime as an integration profile：README quickstart 以一般使用者為主，說明安裝或 link CLI、複製 `.env.example`、設定 `WIKI_STATE_DIR`、設定 Joplin Data API URL/token、執行 `wiki status` 後再執行 `wiki sync` 或 `wiki compile`，且將 `/Users/hermes` runtime 放在進階整合段落；以 README 內容審查與 `node src/wiki.js` help command consistency 驗證。
- [x] [P] 2.2 實作 Add a small documented file structure instead of a packaging framework：新增 `docs/open-source-file-structure.md`，讓貢獻者能區分 root docs、CLI source、tests、Spectra specs、decision docs、environment examples、npm packaging controls、Hermes packaging guidance、public package surface、repo governance 與 deployment guidance；以文件內容審查確認每個責任區都有明確 owner 與非 owner 邊界。
- [x] [P] 2.3 建立 `.env.example` 的 portable configuration contract：範例列出 `WIKI_STATE_DIR`、`WIKI_JOPLIN_API_URL`、`WIKI_JOPLIN_TOKEN`、`DISCORD_SYSTEM_WEBHOOK_URL`、`WIKI_CAPTURE_TELEGRAM_ALLOWLIST`、`WIKI_CAPTURE_DISCORD_ALLOWLIST`、`WIKI_CAPTURE_RATE_LIMIT`、`WIKI_LLM_MODEL`，且所有值都是 placeholder；以 node:test 或 shell-safe content check 驗證沒有真實 token-looking values。

## 3. Security And Hermes Boundary Docs

- [x] [P] 3.1 實作 Open-source safety docs preserve Joplin writeback boundaries 與 Keep security documentation focused on actual trust boundaries：新增 `SECURITY.md`，明確寫出 Joplin SSOT、Joplin Data API only、token/webhook/allowlist 由本機環境或 secret 管理提供、不得提交 env/state/raw cache/drafts，且 `wiki approve` 是唯一正式 Joplin writeback gate；以內容審查確認不承諾不存在的 sandboxing、多使用者隔離、cloud sync、bot hosting 或 publish SLA。
- [x] [P] 3.2 建立 `CONTRIBUTING.md` 的最小貢獻流程：文件說明 Node.js >=20、Node stdlib first、`npm test`、Spectra change workflow、Joplin secret 不進 git、開源文件修改要保留 approve-only writeback 邊界；以內容審查確認新貢獻者可在不接觸真實 Joplin token 的情況下跑測試。
- [x] [P] 3.3 更新 `packaging/hermes/skills/wiki/SKILL.md` 的開源 repo metadata 與 Hermes integration profile 說明，讓 Hermes guidance 仍使用 query/read/links 回答、draft/candidate/audit 不宣稱寫回、approve 成功前不得聲稱已沉澱到 Joplin；以內容審查確認 command names、env boundary 與 approve-only writeback 和 README/SECURITY 一致。

## 4. Verification And Consistency

- [x] 4.1 更新 `docs/design.md` 的開源檔案架構段落，記錄 npm CLI packaging、portable defaults、Hermes runtime profile、security boundary 與 non-goals；以內容審查確認它不承諾 daemon、CI、npm publish、GitHub release 或自動 approve。
- [x] 4.2 增加最小 node:test 覆蓋 package metadata、`.env.example` placeholder safety、README command names 或 package file list中最容易 drift 的契約；以 `npm test` 驗證全部通過。
- [x] 4.3 執行整體開源化驗證：`npm test`、`npm pack --dry-run`、`spectra analyze open-source-file-structure --json`、`spectra validate open-source-file-structure`，並用人工內容審查確認 README、SECURITY、CONTRIBUTING、`.env.example`、`docs/open-source-file-structure.md`、package metadata、Hermes skill 都對齊 `https://github.com/gcake119/llm-wiki-engine-joplin`、portable install path 與 approve-only writeback。
