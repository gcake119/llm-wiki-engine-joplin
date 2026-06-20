## Why

Hermes Wiki Engine 已經能作為本機 wiki CLI 運作，但目前 repo 對外仍混有 private Hermes runtime 假設、planning-spike 文案與缺少開源發佈必要檔案的問題。若要規劃成開源專案，需要先定義最小檔案架構，讓外部使用者能理解安裝、設定、執行、貢獻與安全邊界，同時不破壞 Joplin SSOT 與 review-gated writeback。

這屬於成熟的 open-source project packaging / CLI distribution 領域。主流做法是讓 package metadata、README、license、env example、contribution guide、安全政策與發佈清單各自承擔清楚責任；不應先自製 installer、daemon、plugin registry 或跨平台服務框架。

## What Changes

- 定義開源化所需的最小檔案架構：授權、README、環境變數範例、貢獻指南、安全政策、發佈忽略規則、package metadata 與 Hermes packaging 文件。
- 將 README 從 Hermes 私有 runtime 說明調整成開源 CLI 使用者優先的入口，同時保留 Hermes runtime 作為進階整合路徑。
- 將 package metadata 從 private local tool 調整成可被 npm 安裝與檢查的 CLI package metadata，並以公開 repo `https://github.com/gcake119/llm-wiki-engine-joplin` 作為 repository metadata；但不在此 change 實際發佈到 npm registry 或推送遠端。
- 明確區分 portable open-source defaults 與 /Users/hermes runtime layout，避免新使用者必須擁有 hermes OS user 才能試用。
- 補上 secret handling、Joplin Data API token、Discord webhook、Telegram capture 與 approve-only writeback 的開源安全邊界文件。
- 保持現有 Node stdlib first、node:test、Joplin Data API、local artifacts、wiki approve gate，不新增 runtime dependency。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- hermes-wiki-engine: 增加開源發佈檔案架構與 portable installation contract，要求 CLI package、文件、環境設定範例與 packaging guidance 不得洩漏 secret，也不得弱化 Joplin approve-only writeback 邊界。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - Modified: package.json, README.md, docs/design.md, packaging/hermes/skills/wiki/SKILL.md, openspec/specs/hermes-wiki-engine/spec.md
  - New: LICENSE, SECURITY.md, CONTRIBUTING.md, .env.example, .npmignore, docs/open-source-file-structure.md
  - Removed: none
