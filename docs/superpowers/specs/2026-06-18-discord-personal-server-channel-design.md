# Discord Personal Server Channel Design

## Purpose

Hermes 的 Discord 個人伺服器定位為收集箱、草稿箱與靈感箱，不是長期筆記庫。它用來降低 capture 摩擦、保留專案上下文，並讓 Hermes 之後能從明確的頻道來源產生 draft。Joplin 仍是長期知識庫 SSOT；Discord 內容必須經人工整理與批准後，才可寫回 Joplin。

## Mature Domain Framing

這個設計屬於個人知識管理（PKM）與 agent memory ingestion pipeline。成熟做法通常會把流程拆成：

- capture inbox：快速收集未整理材料。
- incubation space：讓想法、草稿、素材先停留。
- review gate：人工決定哪些內容值得進長期知識庫。
- source of truth：可長期維護、搜尋、引用的正式知識庫。

本設計不把 Discord 做成第二套 wiki，也不把頻道命名當成正式知識分類。Discord 只負責前段收集與草稿整理；Joplin 負責長期保存。

## Design Principles

- 頻道名稱使用繁體中文。
- 保留數字前綴，讓 Discord 側欄排序穩定。
- 少量全域收集箱加上活躍專案頻道。
- 長期主題只保留少數高頻領域，避免變成知識分類樹。
- 不建立「決策」、「待辦」、「學習筆記」等容易取代 Joplin 或任務系統的頻道。
- Telegram 偏向一句話 capture、快速問答與 Hermes 指令；Discord 偏向有上下文的收集、草稿與專案材料。

## Channel Layout

```text
00｜控制台
- #使用說明
- #hermes-指令
- #收集規則

01｜收集箱
- #快速收集
- #連結素材
- #原始暫存

02｜草稿箱
- #想法草稿
- #寫作草稿
- #待整理

03｜活躍專案
- #專案-hermes
- #專案-meeting-agent
- #專案-台南城市系統
- #專案-workflow-radar

04｜長期主題
- #主題-ai-協作
- #主題-流程自動化
- #主題-產品驗證
- #主題-工程學習

05｜回顧與封存
- #準備寫入-joplin
- #已批准紀錄
- #已封存專案
```

## Channel Rules

### 00｜控制台

- `#使用說明`：說明這個 Discord 伺服器的用途與邊界。
- `#hermes-指令`：記錄可由 Hermes 或未來 bot 使用的指令說明。
- `#收集規則`：定義哪些內容放 Discord、哪些內容應直接放 Joplin 或任務系統。

### 01｜收集箱

- `#快速收集`：一句話靈感、截圖描述、臨時想法、還不知道放哪裡的材料。
- `#連結素材`：文章、影片、工具、案例、文件連結。
- `#原始暫存`：大量貼上的原文、log、對話片段，之後再整理。

### 02｜草稿箱

- `#想法草稿`：還沒成形的產品、流程、文章或功能想法。
- `#寫作草稿`：準備變成文件、筆記、提案或說明文的內容。
- `#待整理`：值得留下，但還沒有整理到 Joplin 的材料。

### 03｜活躍專案

活躍專案頻道只放正在推進、需要保留上下文的專案。專案結案後，移到 `#已封存專案` 留索引，不繼續增加新訊息。

### 04｜長期主題

長期主題頻道只放反覆出現、跨專案共用的材料。它們不是正式知識分類；如果內容已經整理成熟，應移到 `#準備寫入-joplin` 或直接整理進 Joplin。

### 05｜回顧與封存

- `#準備寫入-joplin`：Hermes 可從這裡產生 draft，等待人工確認。
- `#已批准紀錄`：只記錄已批准或已寫回 Joplin 的摘要與來源，不放完整正文。
- `#已封存專案`：記錄結案專案的索引、最後狀態與重要連結。

## Non-Goals

- 不用 Discord 取代 Joplin。
- 不在第一版設計 Discord bot 或 API integration。
- 不自動把 Discord 訊息寫回 Joplin。
- 不用頻道名稱承擔完整知識分類。
- 不把 Discord 變成任務管理系統。

## Success Criteria

- 新材料可以在 10 秒內找到合適的暫存頻道。
- 活躍專案材料能保留上下文，不和一般靈感混在一起。
- 長期主題頻道數量維持少量，避免分類膨脹。
- `#準備寫入-joplin` 可以作為未來 `wiki draft discord` 的明確來源。
- `#已批准紀錄` 能回查來源，但正式內容仍以 Joplin 為準。
