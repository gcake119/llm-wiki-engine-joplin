## Why

目前 Hermes Wiki Engine 已能同步 Joplin 全筆記、建立本機 read path、產生最小 graph，並以 draft/approve 保護 Joplin 寫回；但它仍停在 source note mirror，尚未補齊 Karpathy LLM Wiki 模式中的 schema-guided consolidation、reviewable compiled wiki、以及治理循環。若要讓 Hermes 真正把 Joplin 當成可整理、可沉澱、可追溯的長期記憶，需要把這段架構落差收斂成明確的本機流程，而不是讓前台對話臨時自由發揮。

這屬於成熟領域中的 personal knowledge management backend、agent memory ingestion pipeline、local-first retrieval layer。主流做法會拆成 raw source、compiled representation、retrieval/read path、review gate、audit/governance；本變更只補足這些既有層次中的 consolidation 與治理，不建立新的通用 agent framework。

## What Changes

- 定義 schema-guided consolidation：從本機 compiled notes、pages、graph、audit artifacts 產生 reviewable consolidation draft，而不是直接改寫 Joplin。
- 將 compiled wiki page 從一篇 source note 對應一頁，提升為可由多個 source refs 支撐的 topic/entity page draft model。
- 補上 governance artifacts：本機 schema、consolidation manifest、audit outcome，讓 Hermes 可以知道哪些整理結果可讀、哪些仍待人工 approve。
- 保持 read path deterministic：wiki query、wiki read、wiki links 仍只讀已完成本機 artifacts，不呼叫 Joplin Data API、LLM、embedding 或 vector DB。
- 保持 Joplin 寫回安全邊界：只有 wiki approve 可以把已審核 draft 寫入 Joplin，所有整理先留在 filesystem draft。

## Non-Goals

- 不新增 vector database、embedding pipeline、RAG service，或常駐 agent server。
- 不在前台 Hermes 對話期間觸發全庫整理或 LLM consolidation。
- 不做附件 OCR、圖片理解、note history 同步、Joplin resource 全量管理。
- 不自動判斷所有 Telegram、Discord、Joplin 內容是否值得永久保存。
- 不讓 wiki compile 自動寫回 Joplin；寫回仍只走 wiki approve。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- hermes-wiki-engine：補上 LLM Wiki 風格的 schema-guided consolidation、compiled wiki governance、以及 reviewable knowledge sedimentation requirements。

## Impact

- Affected specs: hermes-wiki-engine
- Affected code:
  - New: none
  - Modified: src/wiki.js, test/wiki.test.js, docs/design.md, packaging/hermes/skills/wiki/SKILL.md
  - Removed: none
