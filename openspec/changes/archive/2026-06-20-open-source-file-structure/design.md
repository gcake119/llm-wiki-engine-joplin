## Context

Hermes Wiki Engine 目前已具備可執行的 Node.js CLI：package metadata 宣告 `wiki` bin，CLI 以 Joplin Data API 同步資料、以本機 artifacts 做 query/read/links，並以 `wiki approve` 作為唯一 Joplin writeback gate。問題是 repo 尚未整理成外部使用者能可靠安裝、試跑、貢獻與安全評估的開源專案：README 仍保留 planning-spike 與 Hermes 私有 runtime 字眼，package metadata 仍是 private，本機狀態目錄預設仍偏向 /Users/hermes，且缺少 LICENSE、SECURITY、CONTRIBUTING、.env.example、.npmignore 與開源檔案架構說明。

成熟領域是 open-source CLI packaging。主流做法是讓 package manifest、README、license、security policy、contribution guide、env example、publish allowlist 與 runtime integration docs 分工清楚。這個 change 不需要自製 installer、daemon、queue、GUI 或發佈服務；先把 npm-installable CLI 的檔案邊界整理好。

## Goals / Non-Goals

**Goals:**

- 建立最小開源檔案架構，讓外部使用者能安裝、設定 Joplin Data API、指定 state dir、執行 wiki CLI、理解安全邊界。
- 將 portable CLI 使用者路徑與 Hermes OS user runtime 路徑拆清楚：開源預設可用一般使用者 home 目錄，Hermes packaging 保持進階部署選項。
- 讓 package metadata 可支援 npm pack / npm install 類型的本機驗證，並使用公開 repo `https://github.com/gcake119/llm-wiki-engine-joplin` 作為 repository URL，同時避免把 local state、secret、Spectra archive 以外的雜訊放進 publish tarball。
- 文件明確保留 Joplin SSOT、Joplin Data API boundary、token 不進 git、不印 log、`wiki approve` 唯一 writeback gate。
- 保持 Node stdlib first 與既有 node:test 驗證，不新增 runtime dependency。

**Non-Goals:**

- 不在此 change 發佈 npm package、建立 GitHub release、推送 public repo 或設定 CI secret。
- 不新增 daemon、LaunchDaemon、cron installer、GUI、HTTP server、跨平台 installer 或 package registry automation。
- 不改 Joplin writeback 治理模型，不讓 draft/candidate/audit/automate 繞過 `wiki approve`。
- 不導入新測試框架、bundler、TypeScript migration、lint framework 或 package manager migration。
- 不搬移 Spectra governance、docs/decisions 或 archived changes 作為開源簡化的一部分。

## Decisions

### Use boring npm CLI packaging as the public boundary

`package.json` 保持 Node.js CLI package 形狀，補齊 description、license、repository、keywords、files 或搭配 .npmignore，並移除 private publish blocker。`repository.url` 使用使用者指定的 `https://github.com/gcake119/llm-wiki-engine-joplin`。`bin.wiki` 繼續指向 `src/wiki.js`，不新增 wrapper generator 或 build step。

Alternative considered: 建立 custom install script 或 shell bootstrap。先不採用，因為目前 CLI 已能直接由 Node 執行，custom installer 會增加跨平台與權限維護成本。

### Add a small documented file structure instead of a packaging framework

新增 docs/open-source-file-structure.md 作為開源檔案地圖，列出 root docs、runtime docs、packaging/hermes、src、test、openspec 與 docs/decisions 的責任邊界。這份文件負責說明哪些檔案進 npm package、哪些是 repo governance、哪些是 Hermes-only packaging。

Alternative considered: 把所有說明塞進 README。先不採用，因為 README 要服務首次安裝，檔案治理細節放在獨立文件可降低入口噪音。

### Make portable defaults explicit and keep Hermes runtime as an integration profile

README 與 .env.example 先教一般使用者設定 `WIKI_STATE_DIR` 到 home 目錄下的可寫位置，例如 `$HOME/.local/state/hermes-wiki-engine`。Hermes runtime layout 保留在 packaging/hermes/skills/wiki/SKILL.md 與 docs/open-source-file-structure.md，作為進階部署 profile，而不是開源安裝前提。

Alternative considered: 直接把程式預設 state dir 改成 home-based path。這可能影響既有 Hermes runtime，因此 apply 必須先用測試固定目前 behavior，再決定是否只文件化 portable default 或同步修改 defaultStateDir 與相關測試。

### Keep security documentation focused on actual trust boundaries

SECURITY.md 與 README security section 只承諾目前真實邊界：Joplin Data API token、Discord webhook、Telegram/Discord capture allowlist、local artifacts、secret redaction、approve-only writeback。文件不得暗示已支援 sandboxing、多使用者隔離、cloud sync、full bot hosting 或 automated publish hardening。

Alternative considered: 套用通用大型專案 security policy 模板。先不採用，因為模板常包含不存在的 triage SLA、supported versions 與漏洞通報流程，會讓外部使用者誤解維護承諾。

## Implementation Contract

Observable behavior after implementation:

- A new contributor can read README.md and see one primary open-source quickstart: install package from a checkout or npm-style package, copy .env.example, set `WIKI_STATE_DIR`, set Joplin Data API URL/token, run `wiki status`, then run `wiki sync` or `wiki compile`.
- A new contributor can inspect docs/open-source-file-structure.md and understand which files are public package surface, which files are Hermes integration packaging, and which files are Spectra/decision governance.
- package.json no longer blocks packaging only because of `private: true`, and package metadata names the CLI purpose, license, repository URL `https://github.com/gcake119/llm-wiki-engine-joplin`, keywords, Node engine, bin, and test script.
- npm packaging verification can run without network by using `npm pack --dry-run` or equivalent local command and checking that secrets, local state directories, test temp files, and generated artifacts are excluded.
- .env.example lists supported environment variables with placeholder values only: WIKI_STATE_DIR, WIKI_JOPLIN_API_URL, WIKI_JOPLIN_TOKEN, DISCORD_SYSTEM_WEBHOOK_URL, WIKI_CAPTURE_TELEGRAM_ALLOWLIST, WIKI_CAPTURE_DISCORD_ALLOWLIST, WIKI_CAPTURE_RATE_LIMIT, WIKI_LLM_MODEL. It must not contain real token-looking values.
- SECURITY.md states that Joplin remains SSOT, Joplin integration uses Data API only, tokens must come from environment or local secret files, and `wiki approve` is the only formal Joplin writeback command.
- packaging/hermes/skills/wiki/SKILL.md still tells Hermes to use query/read/links for foreground answers and forbids claiming writeback before approve succeeds.

In scope:

- Root documentation and package metadata needed for open-source readiness.
- A small docs/open-source-file-structure.md file that describes the repo file map.
- Minimal tests or assertions for package metadata, .env.example secret placeholders, and README command consistency if existing node:test can cover them cheaply.
- Updates to openspec/specs/hermes-wiki-engine/spec.md through this change archive.

Out of scope:

- Publishing to npm, pushing to `gcake119/llm-wiki-engine-joplin`, creating GitHub releases, configuring CI, adding badges that imply unavailable automation, adding package signing, or creating release binaries.
- Moving runtime artifacts into the package or checking secrets into the repo.
- Changing the approve gate or making background automation write to Joplin.
- Adding dependency-heavy tooling only to enforce documentation style.

Acceptance criteria:

- `npm test` passes.
- `npm pack --dry-run` or the project-selected local packaging check shows only expected source, documentation, package metadata, tests, specs, and packaging files.
- Manual content review confirms README.md, .env.example, SECURITY.md, CONTRIBUTING.md, docs/open-source-file-structure.md, package.json, and packaging/hermes/skills/wiki/SKILL.md align on command names, env variable names, and approve-only writeback.
- `spectra validate open-source-file-structure` passes before apply and archive.

## Risks / Trade-offs

- [Risk] Removing `private: true` could make accidental publish easier. → Mitigation: this change does not run publish; README and tasks require local packaging verification only, and SECURITY.md must not instruct users to publish with secrets.
- [Risk] README could become too long by mixing open-source quickstart, Hermes runtime, and governance notes. → Mitigation: README keeps quickstart first; docs/open-source-file-structure.md carries the file map and packaging boundaries.
- [Risk] Changing default state dir could break existing Hermes deployment. → Mitigation: apply must either keep code default unchanged and document WIKI_STATE_DIR for open-source users, or update defaultStateDir together with focused tests and Hermes packaging notes.
- [Risk] A generic security template may overpromise maintenance process. → Mitigation: SECURITY.md must describe actual trust boundaries and disclosure contact/process only if the repo owner chooses one during apply.

## Migration Plan

1. Update docs and package metadata in the local repo only.
2. Run node tests and local npm packaging dry run.
3. Verify no generated state, token, webhook URL, local env file, or private runtime artifact is included in the package dry run.
4. Keep Hermes runtime usable by retaining packaging/hermes/skills/wiki/SKILL.md and documenting the absolute-path wrapper as a deployment profile.
5. Rollback is a normal git revert of docs/package metadata changes; no Joplin data or local state migration is involved.

## Open Questions

- Which license should be used for the first public release? Default implementation can use MIT only if the user confirms that license choice.
- Should the npm package name remain `hermes-wiki-engine`, change to `llm-wiki-engine-joplin`, or use a scoped name before publication? This does not block local packaging readiness.
