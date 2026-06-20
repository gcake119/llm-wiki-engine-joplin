## 1. 測試先行

- [x] 1.1 為 `Hermes uses local wiki tools instead of RAG` 補 pnpm symlink bin regression test：透過 symlink 執行 CLI 時必須印出 command output；先用 `pnpm test` 確認失敗。

## 2. 修正 CLI entrypoint

- [x] 2.1 改用 realpath-aware direct execution check，讓 pnpm global bin／symlink 執行時仍會 `console.log(await run(...))`；用 1.1 測試驗證。
- [x] 2.2 為 `Query can rerank bounded candidates with local LLM` 補 Ollama JSON wrapper regression tests：接受 single object、`data` array、`results` array，但 unknown refs 仍 fail closed。
- [x] 2.3 改善 rerank parser：保留 prompt array-only 要求，僅在 rows 全部通過 known source refs 驗證時相容常見 Ollama JSON wrappers。
- [x] 2.4 改善 rerank prompt：要求 `reason` 預設輸出繁體中文，只有術語、產品名、note title、refs 與必要名稱可保留英文或原文；用 prompt regression test 驗證。

## 3. 驗證

- [x] 3.1 跑 `spectra validate fix-pnpm-bin-entrypoint`。
- [x] 3.2 跑 `pnpm test`。
