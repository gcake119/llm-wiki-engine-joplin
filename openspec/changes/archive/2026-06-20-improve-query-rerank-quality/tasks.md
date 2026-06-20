## 1. 測試先行

- [x] 1.1 為 `Query ranks lexical matches deterministically` 補 regression tests：多詞同篇／同段命中必須高於只有 `Joplin` 或只有 `Hermes` 的泛用文章，`Gamdias Hermes` 鍵盤文章必須低於 Hermes wiki engine 長期記憶候選；先用 `node --test test/wiki.test.js` 確認失敗。
- [x] 1.2 為 `Query can rerank bounded candidates with local LLM` 補 rerank prompt regression test：provider 收到的 prompt 必須明確要求區分 Hermes wiki engine／Hermes 長期記憶系統，並降級一般 Joplin 教學、一般 AI 助理文章與鍵盤品牌 Hermes；先用 `node --test test/wiki.test.js` 確認失敗。

## 2. 查詢品質實作

- [x] 2.1 改善 `src/wiki.js` 的 `Query ranks lexical matches deterministically` scoring：加入多詞覆蓋、近距離共現或片段共現加權，並降低單詞泛用命中與鍵盤品牌誤命中；用 1.1 測試驗證。
- [x] 2.2 改善 `src/wiki.js` 的 `Query can rerank bounded candidates with local LLM` prompt：保留 JSON array only 與 source-ref-only 邊界，補上 Hermes wiki engine 語境與非相關類型降級規則；用 1.2 與既有 rerank prompt 邊界測試驗證。

## 3. 規格與驗證

- [x] 3.1 將 delta spec 套回正式 spec 或確認 archive flow 可套用；用 `spectra validate improve-query-rerank-quality` 驗證。
- [x] 3.2 跑完整測試；用 `npm test` 驗證。
