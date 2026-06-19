# 專案決策管理總帳

本目錄管理本專案的產品、工程、成本、資安與 UIUX 決策。Spectra archive 與 openspec specs 是需求與規格事實來源；本目錄負責整理「為什麼做這個決策」、「影響哪些後續工作」與「後續去哪裡查證」。

## 使用原則

- 重大需求取捨、產品邊界、架構邊界、成本模型、資安限制、可重複 UIUX 規則，都應進入本總帳。
- 一次性 UI 細修、單純測試修正、無後續影響的 archive cleanup，可只在 Spectra archive 與 git commit 保留，不必另寫 ADR。
- ADR 只摘要決策，不複製 Spectra 規格全文。需要完整需求與驗證時，回到關聯 archive、正式 spec 與 commit。
- 決策需要落地實作時，另開或更新 Spectra change；不要把 ADR 當成 proposal／tasks 的替代品。

## 決策等級

| 等級 | 何時使用 | 交付物 |
| --- | --- | --- |
| Ledger only | 有紀錄價值，但不會反覆影響後續設計 | 本檔新增一列 |
| ADR | 會影響後續產品、工程、成本、資安或 UIUX 判斷 | 本檔新增一列，並新增 `ADR-xxxx-*.md` |
| Spectra change | 需要改需求、規格、任務或實作 | 先建立 Spectra change，再由本檔或 ADR 連回 change |

## 既有專案導入原則

本目錄自初始化後開始作為專案決策管理層。既有歷史不需要一次完整回填；只回填會反覆影響後續工作的高價值決策。

優先回填：

- 產品邊界
- 跨系統責任分工
- AI／OCR／LLM 自動化程度
- credential／secret／外部 provider
- 附件、PII、檔案儲存
- workflow event 寫入規則
- 正式統計、匯出、報表語意
- 共用 UIUX／DESIGN.md 規則

歷史回填應標註「採用，歷史回填」，並連回 commit、Spectra archive、Superpowers spec 或既有設計文件。

## Decision Ledger

| ID | 日期 | 狀態 | 產品範圍 | 主題 | 決策摘要 | 關聯 Spectra／Archive | 關聯 commit | ADR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-0001 | 2026-06-19 | 採用，歷史回填 | hermes-wiki-engine | Joplin SSOT 與 review-gated writeback | Joplin 是長期知識庫 SSOT；Hermes Wiki Engine 只能透過 Joplin Data API 整合，candidate、draft、compile、audit 不得直接寫回 Joplin，正式沉澱必須經 `wiki approve`。 | `openspec/changes/archive/2026-06-19-strengthen-library-consolidation/` | `ab8ee51` | [ADR-0001](ADR-0001-joplin-ssot-review-gated-writeback.md) |
