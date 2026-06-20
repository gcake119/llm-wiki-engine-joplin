## Problem

專案改用 pnpm global 安裝後，`/Users/hermes/.local/bin/wiki` 透過 pnpm shim／symlink 執行 `src/wiki.js`。目前 CLI entrypoint 用 `import.meta.url === file://${process.argv[1]}` 判斷直接執行；symlink 情境下兩者路徑不同，導致 `run()` 沒有被 `console.log`，所以 `wiki query` exit 0 但 stdout 為空。

## Root Cause

Node.js 執行 symlinked bin 時，module URL 可能解析成真實檔案路徑，而 `process.argv[1]` 保留 shim／symlink 路徑。字串直比無法涵蓋 pnpm global bin 的成熟套件管理情境。

## Proposed Solution

改用 realpath-aware entrypoint 判斷：把 `import.meta.url` 轉成 filesystem path，並與 `process.argv[1]` 的 realpath 比對。若 realpath 相同，才印出 `run()` 結果。

## Non-Goals

- 不改 query ranking、rerank prompt、Ollama provider 或 Joplin state。
- 不改 package manager 設定。
- 不新增依賴。

## Success Criteria

- 直接執行 `node src/wiki.js query` 仍會輸出使用提示。
- 透過 symlink 執行 `node /tmp/wiki query` 也會輸出使用提示。
- `pnpm test` 通過。

## Impact

- Affected code:
  - Modified: src/wiki.js
  - Modified: test/wiki.test.js
  - New: openspec/changes/fix-pnpm-bin-entrypoint/tasks.md
  - New: openspec/changes/fix-pnpm-bin-entrypoint/specs/hermes-wiki-engine/spec.md
  - Removed: none
