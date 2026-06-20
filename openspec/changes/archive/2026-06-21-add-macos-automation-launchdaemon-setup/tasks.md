## 1. 測試先行

- [x] 1.1 為 macOS LaunchDaemon helper 補 regression test：檢查腳本 shell syntax、wrapper path、LaunchDaemon plist path、`UserName`、`wiki automate once`、log path、以及不得包含 token/writeback/approve；先用 `node --test --test-name-pattern "LaunchDaemon" test/wiki.test.js` 驗證。

## 2. 實作與文件

- [x] 2.1 新增 `scripts/install-macos-launchdaemon.sh`：安裝 wrapper 與 LaunchDaemon plist，預設 user `hermes`、label `com.hermes.wiki-automate`、每天 03:30，可用環境變數覆寫。
- [x] 2.2 更新 `README.md`：加入 macOS LaunchDaemon 安裝、kickstart、`launchctl print`、`wiki automate status`、最近 24 小時 artifacts 檢查指令。
- [x] 2.3 更新 `docs/design.md`：把外部排程邊界改成提供可選 LaunchDaemon helper，但核心 CLI 仍不內建常駐 scheduler、不自動 approve。

## 3. 驗證

- [x] 3.1 跑 `sh -n scripts/install-macos-launchdaemon.sh`。
- [x] 3.2 跑 `node --test --test-name-pattern "LaunchDaemon" test/wiki.test.js`。
- [x] 3.3 跑 `spectra validate add-macos-automation-launchdaemon-setup`。
