## Summary

新增 macOS LaunchDaemon 安裝輔助腳本，讓 operator 可以把 `wiki automate once` 安裝成每天固定執行的 Hermes 背景整理工作。

## Motivation

Hermes 環境已驗證 `wiki automate once` 可以成功執行 sync、compile、draft candidates 與 audit，但手動建立 LaunchAgent/LaunchDaemon 時 shell quoting 很容易出錯。實際驗證也顯示 hermes 沒有 GUI LaunchAgent domain，適合使用 system LaunchDaemon 以 `hermes` user 執行。

這屬於 macOS launchd operational packaging，不是 wiki query、Joplin writeback 或 LLM 自動決策變更。腳本應只負責排程 one-shot maintenance runner，不應自動 approve 或寫入 Joplin notes。

## Proposed Solution

- 新增 `scripts/install-macos-launchdaemon.sh`。
- 腳本預設安裝並載入 `com.hermes.wiki-automate` LaunchDaemon，每天 03:30 執行。
- 腳本建立 `/Users/<user>/bin/wiki-automate-once` wrapper，設定 PATH、source env file，並執行 `wiki automate once`。
- 腳本建立 `/Library/LaunchDaemons/com.hermes.wiki-automate.plist`，以指定 user 執行 wrapper，stdout/stderr 寫到 user logs。
- README 補上安裝、驗證、手動 kickstart 與 status 檢查指令。

## Non-Goals

- 不新增常駐 daemon runtime。
- 不自動 approve，不寫入 Joplin notes。
- 不管理 Joplin token，不把 secret 寫入 plist。
- 不取代 operator review。
- 不支援 Linux systemd 或 Windows Scheduler。

## Impact

- Affected specs: `hermes-wiki-engine`
- Affected code:
  - New: `scripts/install-macos-launchdaemon.sh`
  - Modified: `README.md`
  - Modified: `docs/design.md`
  - Modified: `test/wiki.test.js`
  - New: `openspec/changes/add-macos-automation-launchdaemon-setup/tasks.md`
  - New: `openspec/changes/add-macos-automation-launchdaemon-setup/specs/hermes-wiki-engine/spec.md`
  - New: `openspec/changes/add-macos-automation-launchdaemon-setup/design.md`
  - Removed: none
