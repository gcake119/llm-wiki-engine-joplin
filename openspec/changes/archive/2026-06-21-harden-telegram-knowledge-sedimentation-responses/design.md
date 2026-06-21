## Context

目前 Hermes Wiki Engine 已有清楚的 Joplin SSOT 與 review-gated writeback 邊界：Telegram／Discord 是 capture source，`wiki draft`／`wiki capture` 只能產生 filesystem draft，正式寫回只允許 `wiki approve`。實際使用上，Telegram bot 的自然語言回覆若說「我會將其收進筆記庫」或在工具空回應後沿用成功語氣，會讓使用者誤判沉澱狀態。

這個問題屬於 conversational retrieval interface 與 agent tool-calling 的成熟領域。常見模式不是讓聊天模型自由判斷成功與否，而是把工具結果轉成明確狀態：suggested、draft_created、approved、failed。聊天層只能依照狀態輸出，不能自行宣稱已寫入長期知識庫。

## Goals / Non-Goals

**Goals:**

- 讓 Hermes／Telegram 對知識沉澱的自然語言回覆遵守 draft-first、approve-gated 狀態契約。
- 讓工具空回應、失敗、缺少必要 id 時 fail closed，不再輸出成功語氣。
- 讓 draft 建立成功與 Joplin approve 成功有不同、可驗證的使用者文案。
- 保留現有 Joplin Data API 與 filesystem artifact 邊界。

**Non-Goals:**

- 不在本 change 內新增 Telegram bot adapter、Hermes gateway runtime 或常駐服務。
- 不改變 `wiki approve` 的寫回語意。
- 不新增外部 dependency、queue、database 或 hosted service。
- 不把 LLM rerank、semantic score、automation summary、pending draft 當成正式知識來源。

## Decisions

### Use an explicit sedimentation response contract

聊天層與 Hermes skill 必須使用明確狀態詞：

- `suggested`：模型認為內容適合沉澱，但尚未建立 draft。
- `draft_created`：工具結果包含 `draft_id`，可說已建立待審草稿，但必須說尚未寫入 Joplin。
- `approved`：工具結果包含 `joplin_note_id`，才可說已寫回 Joplin。
- `failed`：工具失敗、空回應、缺少必要 id、或狀態不明時，必須說無法確認成功。

選擇這個契約，是因為它符合 agent tool-calling 的主流做法：工具結果是狀態來源，聊天模型只是呈現層。替代方案是只靠 prompt 禁止誇大語氣，但 prompt-only 沒有可測試的狀態邊界，容易在工具失敗時退回舊文字。

### Keep writeback proof stricter than draft proof

`draft_id` 只能證明 filesystem draft 建立成功；它不得被當成 Joplin 已寫入證據。只有 `wiki approve` 回傳 `joplin_note_id` 才能宣稱正式寫回。

替代方案是允許「已收進筆記庫」泛指 draft，但這會混淆 pending review artifact 與 Joplin SSOT，因此不採用。

### Treat empty tool responses as failed, not successful

如果 tool-calling runtime 回傳空字串、空 JSON、沒有 stdout、或沒有可解析 JSON，聊天層必須回報工具沒有提供可驗證結果。不得使用「Empty response after tool calls」這類 runtime 診斷作為使用者文案，也不得沿用先前已準備的成功訊息。

替代方案是 fallback 到模型原本草稿，但這正是目前問題來源，因此不採用。

### Keep the implementation small and local

本 change 的實作應優先補 Hermes skill guidance、README／design 說明，以及最小的 Node stdlib 測試／helper。若實作需要一個共用 formatter，應放在現有 CLI 模組內，輸入工具結果 JSON，輸出安全的 user-facing 狀態摘要；不應新增 Telegram 專用 adapter。

## Implementation Contract

Observable behavior:

- 當使用者透過 Telegram／Hermes 表示「沉澱這段知識」時，若尚未成功建立 draft，回覆只能說可以建立或建議建立待審草稿，不得說已收進筆記庫。
- 當 draft 工具成功且結果包含 `draft_id` 時，回覆必須包含該 `draft_id`，並明確說尚未寫入 Joplin、需要 review／approve。
- 當 approve 工具成功且結果包含 `joplin_note_id` 時，回覆才可以說已寫回 Joplin，並必須包含 Joplin note id 或可追蹤證據。
- 當工具空回應、工具失敗、JSON 無法解析、結果缺少 `draft_id` 或 `joplin_note_id` 時，回覆必須說無法確認已建立或已寫回，並避免成功語氣。
- 使用者可見回覆不得包含 runtime fallback 診斷字串、raw stack trace、token、env、webhook URL 或 secret。

Interface / data shape:

- Draft success proof: JSON result with `ok: true`, `state: "drafted"`, and non-empty `draft_id`.
- Approve success proof: JSON result with `ok: true`, `state: "approved"`, and non-empty `joplin_note_id`.
- Failure proof: JSON result with `ok: false` or missing required success proof fields.
- Unknown proof: empty response, non-JSON response where JSON is expected, or an orchestration-level empty tool response.

Acceptance criteria:

- Spec scenarios cover draft-only success, approve success, and empty-tool fail-closed behavior.
- Hermes skill guidance tells the agent not to claim Joplin writeback without `joplin_note_id`.
- Tests or documented verification cover response classification for draft success, approve success, and empty response failure.
- `spectra validate` passes.

Scope boundaries:

- In scope: reply contract, skill guidance, docs, tests, and small helper code if needed.
- Out of scope: implementing Telegram bot transport, changing Hermes gateway internals outside this repo, changing Joplin writeback semantics, or auto-approving drafts.

## Risks / Trade-offs

- [Risk] 使用者會覺得多一層 review 比較慢 → Mitigation: 回覆文案要清楚說明 draft id 與下一步，讓 review gate 變成可操作狀態，而不是模糊阻礙。
- [Risk] 外部 Hermes gateway 仍可能忽略 repo skill guidance → Mitigation: 把契約寫進 Spectra spec 與 packaging skill，未來 gateway 實作可用同一批測試案例對齊。
- [Risk] 過度實作 formatter 會把 repo 推向 Telegram adapter → Mitigation: 只做狀態分類與安全文案，不新增 transport 或 bot runtime。
