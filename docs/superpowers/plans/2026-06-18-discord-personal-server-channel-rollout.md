# Discord Personal Server Channel Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Hermes 個人 Discord 伺服器的繁體中文頻道結構，讓它成為收集箱、草稿箱與靈感箱，而不是長期筆記庫。

**Architecture:** 第一版只使用 Discord 原生類別與文字頻道。Joplin 仍是長期知識庫 SSOT；Discord 只作為 capture 與 draft staging space，不接 bot、不接 API、不自動寫回。

**Tech Stack:** Discord 伺服器管理 UI、繁體中文頻道命名、人工驗收清單。

---

## File Structure

本計畫不需要修改程式碼。唯一已存在的設計依據是：

- Read: `docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md`

本計畫的執行結果存在 Discord 伺服器設定內，不新增 repo 檔案。若未來要接 `wiki draft discord`，再另開 Spectra change 記錄 Discord channel id 與 capture contract。

## Scope Check

這份 spec 只涵蓋 Discord 頻道配置與使用規則，不包含 Discord bot、API integration、Joplin writeback、權限自動化或 Hermes command bridge 實作。範圍足夠小，可以用單一 rollout plan 完成。

### Task 1: 建立 Discord 類別與頻道

**Files:**
- Read: `docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md`
- Create: none
- Modify: none

- [ ] **Step 1: 開啟 Discord server settings**

在 Discord 桌面版或網頁版開啟個人伺服器。確認你有 `Manage Channels` 權限。

Expected: 可以新增 category 與 text channel。

- [ ] **Step 2: 建立 `00｜控制台` 類別**

建立 category：

```text
00｜控制台
```

在該 category 底下建立文字頻道：

```text
使用說明
hermes-指令
收集規則
```

Expected: 側欄顯示 `00｜控制台`，底下有三個文字頻道。

- [ ] **Step 3: 建立 `01｜收集箱` 類別**

建立 category：

```text
01｜收集箱
```

在該 category 底下建立文字頻道：

```text
快速收集
連結素材
原始暫存
```

Expected: 側欄顯示 `01｜收集箱`，底下有三個文字頻道。

- [ ] **Step 4: 建立 `02｜草稿箱` 類別**

建立 category：

```text
02｜草稿箱
```

在該 category 底下建立文字頻道：

```text
想法草稿
寫作草稿
待整理
```

Expected: 側欄顯示 `02｜草稿箱`，底下有三個文字頻道。

- [ ] **Step 5: 建立 `03｜活躍專案` 類別**

建立 category：

```text
03｜活躍專案
```

在該 category 底下建立文字頻道：

```text
專案-hermes
專案-meeting-agent
專案-台南城市系統
專案-workflow-radar
```

Expected: 側欄顯示 `03｜活躍專案`，底下有四個文字頻道。

- [ ] **Step 6: 建立 `04｜長期主題` 類別**

建立 category：

```text
04｜長期主題
```

在該 category 底下建立文字頻道：

```text
主題-ai-協作
主題-流程自動化
主題-產品驗證
主題-工程學習
```

Expected: 側欄顯示 `04｜長期主題`，底下有四個文字頻道。

- [ ] **Step 7: 建立 `05｜回顧與封存` 類別**

建立 category：

```text
05｜回顧與封存
```

在該 category 底下建立文字頻道：

```text
準備寫入-joplin
已批准紀錄
已封存專案
```

Expected: 側欄顯示 `05｜回顧與封存`，底下有三個文字頻道。

- [ ] **Step 8: 檢查排序**

確認 Discord 側欄類別順序如下：

```text
00｜控制台
01｜收集箱
02｜草稿箱
03｜活躍專案
04｜長期主題
05｜回顧與封存
```

Expected: 類別順序與上方完全一致。

### Task 2: 填入最小使用說明

**Files:**
- Read: `docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md`
- Create: none
- Modify: none

- [ ] **Step 1: 在 `#使用說明` 貼上定位說明**

貼上：

```text
這個 Discord 伺服器是 Hermes 的收集箱、草稿箱與靈感箱，不是長期筆記庫。

原則：
- Discord：暫存、整理、保留上下文。
- Telegram：一句話 capture、快速問答、臨時指令。
- Joplin：長期保存與正式知識庫。

內容要進 Joplin 前，先放到 #準備寫入-joplin，再人工確認。
```

Expected: `#使用說明` 第一則訊息清楚說明 Discord 不是長期筆記庫。

- [ ] **Step 2: 在 `#收集規則` 貼上頻道使用規則**

貼上：

```text
放這裡：
- 快速收集：一句話靈感、截圖描述、還不知道放哪裡的材料。
- 連結素材：文章、影片、工具、案例、文件連結。
- 原始暫存：大量原文、log、對話片段。
- 想法草稿：還沒成形的產品、流程、文章或功能想法。
- 寫作草稿：準備變成文件、筆記、提案或說明文的內容。
- 待整理：值得留下，但還沒有整理到 Joplin 的材料。
- 準備寫入-joplin：等待 Hermes 產生 draft 或人工整理的材料。
- 活躍專案：只放正在推進、需要上下文的專案；結案後移到 #已封存專案 留索引，不再增加新訊息。
- 長期主題：只放反覆出現、跨專案共用的材料；不是正式知識分類，成熟內容要移到 #準備寫入-joplin 或整理進 Joplin。
- 已批准紀錄：只放已批准或已寫回 Joplin 的摘要與來源，不放完整正文。
- 已封存專案：只留結案專案索引、最後狀態與重要連結。

不要放這裡：
- 已經整理完成的長期筆記，請放 Joplin。
- 可執行任務，請放任務系統或專案工作流。
- 敏感 token、密碼、私鑰、個資原文。
```

Expected: `#收集規則` 明確區分 Discord、Joplin 與任務系統。

- [ ] **Step 3: 在 `#hermes-指令` 貼上第一版邊界**

貼上：

```text
第一版不接 Discord bot，也不自動寫回 Joplin。

未來可規劃：
- wiki draft discord：從指定頻道產生 draft。
- wiki approve：人工確認後寫回 Joplin。

目前操作：
- 把要整理的材料移到 #準備寫入-joplin。
- 由人工或 Hermes 對話整理成 Joplin 筆記。
```

Expected: `#hermes-指令` 沒有承諾尚未存在的 bot 或自動化。

### Task 3: 驗收頻道是否符合收集箱定位

**Files:**
- Read: `docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md`
- Create: none
- Modify: none

- [ ] **Step 1: 做 10 秒放置測試**

拿三個假想材料，分別判斷 10 秒內應放哪裡：

```text
材料 1：一篇 Workflow Automation 文章連結
Expected: #連結素材 或 #主題-流程自動化

材料 2：Meeting Agent 下一版 prompt 想法
Expected: #專案-meeting-agent 或 #想法草稿

材料 3：一段很長的錯誤 log
Expected: #原始暫存
```

Expected: 每個材料都能在 10 秒內找到合理頻道。

- [ ] **Step 2: 檢查是否有知識庫膨脹訊號**

檢查頻道清單是否出現下列名稱：

```text
決策
待辦
任務
專案待辦
學習筆記
知識庫
知識分類
wiki
永久筆記
文獻筆記
```

Expected: 不存在上述頻道。若已建立，刪除或改回目前設計內的頻道。

- [ ] **Step 3: 檢查 Joplin 邊界**

確認 `#使用說明` 或 `#收集規則` 中包含：

```text
內容要進 Joplin 前，先放到 #準備寫入-joplin，再人工確認。
```

確認 `#收集規則` 中包含：

```text
只放已批准或已寫回 Joplin 的摘要與來源，不放完整正文。
```

確認 `#使用說明` 或 `#收集規則` 沒有把 Discord 描述為：

```text
wiki
長期知識庫
正式知識分類
任務系統
```

Expected: Joplin 是長期知識庫 SSOT；Discord 只做 capture 與 draft staging，沒有被描述成正式知識庫、正式分類或任務系統，也沒有自動寫回承諾。
