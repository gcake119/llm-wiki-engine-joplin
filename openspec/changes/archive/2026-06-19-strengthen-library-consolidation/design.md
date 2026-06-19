## Context

Hermes Wiki Engine 目前已能從 Joplin Data API 同步 raw notes、compile 本機 notes/pages/graph/schema、提供 query/read/links/audit，並用 draft/approve 保護 Joplin writeback。缺口在於全庫整理流程仍偏第一版：candidate discovery 只用 title topic grouping，compiled page 幾乎是一個 source note 的 wrapper，approve 前需要人工編輯 draft JSON 才能補 target notebook。

成熟領域是 local-first knowledge compilation pipeline 與 personal knowledge management backend。主流做法會把 source of truth、ingestion cache、compiled artifacts、review queue、writeback gate 分層；本設計沿用這個分層，不把 repo 擴成 RAG service 或 agent framework。

## Goals / Non-Goals

**Goals:**

- 讓 full-library candidate discovery 使用多個 deterministic signals，輸出可排序、可解釋、bounded 的候選。
- 讓 compile 產生 topic/entity style pages，每個 section 都能追溯到 source note refs。
- 讓 draft creation 支援 target notebook 輸入，降低 approve 前人工補 JSON 的摩擦。
- 讓 audit 覆蓋 candidate、compiled page、draft target 的 deterministic governance errors。
- 讓 Hermes skill 明確指示全庫整理的候選、draft、audit、approve 順序。

**Non-Goals:**

- 不導入 embedding、vector database、semantic reranker、RAG service 或 foreground LLM retrieval。
- 不自動 approve 或自動寫回 Joplin；wiki approve 仍是唯一 writeback gate。
- 不讀取 Joplin SQLite、Joplin profile 或其他跨使用者檔案。
- 不實作 Telegram／Discord capture、附件 OCR、背景 queue、LaunchDaemon 或多使用者平台。
- 不承諾自動判斷知識價值；候選只是協助 operator 排序與審核。
- 不實作背景排程或 daemon、LLM 摘要、語意去重、embedding/vector DB/RAG service、自動保存判斷、自動 draft-to-compiled-page promotion，或完整 Telegram／Discord ingestion bot；這些列入下一輪自動化設計。

## Decisions

### Deterministic multi-signal candidates

`wiki draft candidates` 仍只讀 completed compiled artifacts。候選分數由 stdlib 可重現的 signals 組成：

- `title_prefix`: normalized title 前兩到三個 token 相同，適合拆成多篇的系列筆記。
- `same_parent`: 多篇 notes 來自同一 `parent_id`，代表同 notebook context。
- `markdown_link`: graph 內存在 note-to-note markdown link。
- `shared_page_source`: notes 同時被同一 compiled page 引用。
- `recent_cluster`: notes 的 `updated_time` 落在同一固定時間窗，例如同一天。

每個 candidate 輸出 `candidate_id`、`refs`、`reasons`、`score`、`priority`、`goal`、`status`、`proposed_target`。`reasons` 是陣列，不再只有單一 reason。`priority` 由分數 bucket 決定：高分為 `high`，中分為 `medium`，低分為 `low`。排序固定為 score desc，再用 candidate_id asc 打破平手。

替代方案是直接用 embedding 或 LLM clustering。這會更像產品 demo，但會增加成本、不可重現性與權限／token 邊界，和目前 model-free read path 不一致，所以不採用。

### Source-backed topic/entity page compilation

`wiki compile` 不再只輸出一 note 一 page 的薄 wrapper。它先保留 source note refs，再依 deterministic topic key 聚合 notes。第一版 topic key 使用 normalized title prefix 與 parent context；同 topic 的 notes 形成一個 page。page shape 維持現有欄位，但補強語意：

- `page_id`: stable hash 或 safe slug，必須可用 safe local filename。
- `title`: 從 topic key 產生的人讀標題。
- `aliases`: 聚合 source titles。
- `tags`: 第一版保持空陣列，除非 raw metadata 已有可用欄位。
- `summary`: deterministic extractive summary，使用 bounded source excerpts 串接，不生成 unsupported facts。
- `sections`: 至少包含 source overview section；每個 section 必須有 `sources`。
- `links`: 只包含已知 page ids。
- `sources`: 所有 source note ids。

替代方案是用 LLM 直接寫 wiki pages。這比較接近完整 LLM-Wiki，但會引入 semantic hallucination 與 prompt governance；本 change 只先建立可驗證的 source-backed page substrate。

### Review-gated target ergonomics

`wiki draft consolidate` 與 `wiki draft candidate` 可以接受 target notebook，並把 target 寫入 draft 的 `intended_target.notebook_id`。建議介面是 `--target-notebook <notebook-id>`，candidate artifact 也可帶 `proposed_target.notebook_id`，candidate-to-draft 時若 operator 未覆蓋 target，就沿用 candidate proposed target。

approve 行為不放寬：draft 必須有 provenance、content、conflict behavior 與 target notebook；缺任何一項就回 `DRAFT_APPROVAL_INVALID`，且不呼叫 Joplin。這降低人工補 JSON，但不移除審核閘門。

### Governance audit for consolidation artifacts

`wiki audit` 擴充到三類 artifact：compiled pages、candidates、drafts/reviews。它應檢查：

- candidate refs 是否存在於 compiled notes 或 pages。
- candidate refs 數量是否足以整理，少於兩個 ref 記為 `candidate_too_small`。
- candidate proposed target 若存在，格式必須 safe；若候選已轉 draft，draft target 缺失仍記 `draft_target_missing`。
- page sections 有文字但沒有 sources 時記 `evidence_gap`。
- page links 或 graph links 指向不存在節點時記 `dangling_link`。

audit 只寫 `audit/error-book.json`，不改 compiled artifacts、不改 drafts、不呼叫 Joplin、不呼叫 LLM。

### Deferred automation track

本 change 完成的是 deterministic、review-gated consolidation substrate。完整自動化拆到後續 change，避免把本地知識整理、LLM 生成、retrieval infrastructure 與 capture bot 一次塞進同一個 release。

後續自動化分成六個獨立設計面：

- Background scheduling：定義 `wiki sync`、`wiki compile`、`wiki draft candidates`、`wiki audit` 的排程模型、lock 行為、失敗重試與通知，不改變 foreground query/read 的 source-backed contract。
- LLM summarization and semantic dedupe：只允許從 compiled source refs 產生 draft summary 或 dedupe recommendation；輸出必須保留 provenance，且不得直接寫回 Joplin。
- Embedding/vector/RAG retrieval：若導入，必須作為 compiled artifacts 的可重建索引層，不取代 Joplin SSOT，也不能讓 foreground answer 脫離 source refs。
- Save-worthiness automation：自動判斷「值得保存」只能產生 candidate 或 draft recommendation；正式保存仍需 review evidence 與 approve gate，除非另一次 change 明確修改 governance。
- Draft promotion：自動把 approved consolidation draft 納入 compiled page 必須經由 Joplin writeback 後下一輪 sync/compile，或另設 local promotion artifact；本 change 不直接把 pending draft 當正式 page source。
- Telegram／Discord ingestion bot：capture runtime 需要 allowlist、rate limit、redaction、attachment policy、secret handling 與 failure evidence；目前 CLI draft path 只是合約，不是完整 bot。

這些項目屬於 mature domains：job scheduling、LLM-assisted knowledge management、semantic search、capture ingestion pipeline。下一輪 proposal 應先選一個面向，不要一次導入新 daemon、LLM pipeline、vector DB 與 bot runtime。

#### Follow-up change: background scheduler

Mature domain: local job scheduling and daemon supervision. Prefer the smallest platform-native layer that can run existing commands and observe lock/status files before adding a queue service.

Planned behavior:

- Trigger `wiki sync` on a short interval, for example every 15 minutes, only when no lock exists.
- Trigger `wiki compile` on a longer interval or after sync reports changed notes; compile must remain skip-safe when raw cache is missing.
- Trigger `wiki draft candidates --limit <N>` after successful compile, with a fixed bounded limit.
- Trigger `wiki audit` after candidate discovery and after any approve/reject operation if the scheduler can observe review artifacts.
- Never run scheduled jobs inside foreground `wiki query`, `wiki read`, or `wiki links`; foreground commands only read completed artifacts.

Lock and retry contract:

- Existing lock file remains the first concurrency gate; a scheduled job that sees `WIKI_BUSY` records skipped status and exits successfully from the supervisor's perspective.
- Retry only transient failures: Joplin API unavailable, network fetch failure, notification failure, or state dir temporarily unavailable.
- Do not retry validation failures such as missing token, unsafe ids, draft approval invalid, or missing source artifacts without operator intervention.
- Use bounded retries with backoff and write final failure evidence to status or logs; do not loop indefinitely.

Notification contract:

- Successful daily health summaries may be sent through the existing system notification path.
- Immediate alerts are only for repeated failures, token missing, state dir unavailable, or audit error count crossing a configured threshold.
- Notifications must not include Joplin token, webhook URL, raw note body, or draft content.

Acceptance criteria for the next change:

- A scheduled run can execute sync, compile, candidates, and audit in order without writing Joplin notes.
- If a foreground query starts while a scheduled compile is active, it either reads the previous completed artifacts or reports the existing lock/status state; it must not trigger a compile.
- Repeated `WIKI_BUSY` or transient API failures produce bounded evidence, not overlapping jobs.
- The implementation uses existing CLI commands and stdlib/platform scheduling before introducing a new dependency or service.

#### Follow-up change: LLM summarization and semantic dedupe

Mature domain: LLM-assisted knowledge management. Treat the model as a draft assistant, not as a source of truth.

Planned behavior:

- Input is only compiled source refs: `note:<id>` and `page:<id>` resolved through local compiled artifacts.
- LLM output may create a draft summary, dedupe recommendation, merge rationale, or suggested title.
- Every generated paragraph must carry source refs at the draft section level.
- The model must not read Joplin directly and must not write Joplin notes.
- Semantic dedupe can rank or explain likely duplicates, but the output remains a candidate or draft recommendation.

Provenance and safety contract:

- Drafts store `model`, prompt version, source refs, created time, and bounded source excerpts.
- If source refs are missing, stale, or too large for the configured context limit, the command fails closed or produces an incomplete recommendation with explicit evidence status.
- The default development path should prefer local `ollama call` before paid cloud APIs.
- Generated content is never accepted as foreground answer evidence unless `wiki read/query/links` can still point to source-backed refs.

Acceptance criteria for the next change:

- A test fixture with two compiled notes can produce a reviewable LLM-assisted consolidation draft without calling Joplin.
- A missing source ref prevents draft creation.
- The draft artifact records model/prompt/source provenance and keeps `intended_target.conflict_behavior: "manual_review"`.
- Approve remains unchanged: only a complete, reviewed draft with target notebook can write through Joplin Data API.

#### Follow-up change: embedding, vector, and RAG retrieval

Mature domain: semantic search and retrieval-augmented generation. Keep this as a rebuildable index layer, not a new source of truth.

Planned behavior:

- Build embeddings only from `compiled/notes.json`, `compiled/pages.json`, and page files.
- Store vector index metadata under local rebuildable artifacts, not in Joplin.
- Query may use semantic retrieval to find candidate refs, but final foreground answers must include source refs and evidence status.
- If vector artifacts are missing or stale, fallback to existing lexical `wiki query` instead of inventing answers.

Index contract:

- Each indexed chunk records source ref, source body hash or page id, chunk text bounds, embedding model, embedding dimensions, and index created time.
- Rebuild is deterministic with respect to compiled artifact versions and configured model.
- Vector search results are refs plus scores; they are not user-facing claims by themselves.
- The system must support deleting/rebuilding the index without losing Joplin knowledge.

Acceptance criteria for the next change:

- Rebuilding the vector index from compiled artifacts produces queryable refs without Joplin API calls.
- Foreground semantic query returns source-backed refs and can call `wiki read` for evidence.
- Stale index detection works when a source body hash changes.
- No RAG answer is emitted unless at least one retrieved source ref is available.

#### Follow-up change: save-worthiness and draft promotion

Mature domain: review queue automation and content lifecycle governance. Automation can rank and prepare work; it should not silently change the durable knowledge base.

Planned behavior:

- Save-worthiness scoring produces candidates or reviewable drafts only.
- Signals can include source density, repeated themes, explicit action language, manual pin/reject history, and recency.
- A score never bypasses `wiki approve`; it only changes priority or recommendation text.
- Approved consolidation drafts enter official knowledge through Joplin writeback, then the next sync/compile imports them as normal source-backed content.

Promotion contract:

- Pending drafts are not compiled pages and are not foreground answer sources.
- Approved drafts can be represented as review evidence and rollback hints after Joplin writeback succeeds.
- If a future local promotion artifact is introduced, it must be separate from `compiled/pages.json` and clearly marked non-SSOT until backed by Joplin.
- Rejected candidates and drafts should reduce future recommendation priority without deleting source notes.

Acceptance criteria for the next change:

- Save-worthiness output includes `score`, `reasons`, `refs`, and `recommended_action`, and writes no Joplin notes.
- A high score cannot call `wiki approve` or create a compiled page directly.
- After approve succeeds and a later sync/compile runs, the approved Joplin note can appear in compiled artifacts through the normal ingestion path.
- Audit can report pending high-priority drafts and rejected/approved counts without changing decisions.

#### Follow-up change: Telegram and Discord ingestion bot

Mature domain: capture ingestion pipeline. Bot runtime must be constrained before it can create drafts from chat streams.

Planned behavior:

- Telegram ingestion only accepts allowlisted chat ids.
- Discord ingestion only accepts allowlisted guild/channel ids for the personal server boundary.
- Bot capture normalizes message batches into filesystem drafts; it does not write Joplin notes.
- Attachments are metadata-only until a later OCR/download policy exists.

Security and failure contract:

- Secrets come from env or config files with restricted permissions and must never be printed.
- Rate limits cap messages per batch and batches per interval.
- Redaction runs before draft write for obvious secrets, tokens, and personal contact details.
- Each draft stores source platform, channel/chat id, message range, capture time, redaction status, and failure warnings.
- API failures, permission failures, and rate limit skips write local failure evidence without retry storms.

Acceptance criteria for the next change:

- A mocked Telegram or Discord event from an allowlisted source creates a pending filesystem draft with provenance.
- A non-allowlisted source is ignored and records no durable knowledge draft.
- A message containing a token-like secret is redacted before draft content is written.
- No bot flow calls Joplin Data API except through the existing manual `wiki approve` command.

## Implementation Contract

**Behavior:**

- `wiki draft candidates --limit N` 在 compiled artifacts 存在時輸出最多 N 個候選，候選使用 deterministic multi-signal scoring，包含 `reasons` 陣列、numeric `score`、bucketed `priority`、`refs`、`goal`、`status`、`proposed_target`。
- `wiki compile` 從 raw cache 產生 grouped topic/entity pages；每個 page section 必須有 source note refs，page 必須能被 `wiki read page:<id>` 與 `wiki links page:<id>` 使用。
- `wiki draft consolidate --target-notebook <id> --ref note:<id> "整理內容"` 建立 draft 時直接保存 target notebook，不寫 Joplin。
- `wiki draft candidate <candidate-id> --target-notebook <id>` 建立 candidate draft 時保存 target notebook；未提供時可沿用 candidate artifact 的 proposed target。
- `wiki approve <draft-id>` 仍只在 target notebook 存在且 Joplin token 存在時寫 Joplin note。
- `wiki audit` 將 candidate 與 draft target 問題寫入 error book，並在 command output 的 `kind_counts` 反映數量。

**Interface / data shape:**

- Candidate artifact path 維持 `candidates/consolidation-candidates.json`。
- Candidate item 新增或保留欄位：`candidate_id`、`refs`、`reasons`、`score`、`priority`、`goal`、`status`、`proposed_target`。
- Draft item 的 `intended_target.notebook_id` 可由 CLI target flag 或 candidate proposed target 填入。
- Page artifacts 維持 `compiled/pages.json` 與 `compiled/pages/<page-id>.json`，但 page 可聚合多個 source notes。

**Failure modes:**

- 缺 compiled artifacts 時，candidate discovery 回 `WIKI_COMPILED_INDEX_MISSING`，不寫 candidates 或 drafts。
- unsafe target notebook id 回 `DRAFT_TARGET_UNSAFE`，不寫 draft。
- candidate refs 指向不存在 source 時，candidate-to-draft 回 `DRAFT_SOURCE_MISSING`，不寫 draft。
- approve 缺 target 時仍回 `DRAFT_APPROVAL_INVALID`，不呼叫 Joplin。

**Acceptance criteria:**

- `node --test` 包含 candidate scoring、grouped page compile、target notebook draft、candidate audit、approve gate 的測試。
- `spectra analyze strengthen-library-consolidation --json` 無 Critical 或 Warning。
- `spectra validate strengthen-library-consolidation` 通過。

**Scope boundaries:**

- In scope: `src/wiki.js`、`test/wiki.test.js`、`docs/design.md`、`packaging/hermes/skills/wiki/SKILL.md`、`openspec/specs/hermes-wiki-engine/spec.md`。
- Out of scope: 新 dependency、新背景服務、新資料庫、Joplin SQLite、LLM summarization、embedding、OCR、Telegram／Discord capture runtime。
- Tracked follow-up: 背景排程或 daemon、LLM 摘要、語意去重、embedding/vector/RAG、自動保存判斷、自動 draft promotion、完整 Telegram／Discord ingestion bot。

## Risks / Trade-offs

- [Risk] Deterministic heuristics 找不到語意相近但字面不同的筆記 → Mitigation: 輸出 bounded candidates 並保留 manual explicit-ref `wiki draft consolidate` 作為補充路徑。
- [Risk] Topic key 聚合錯誤導致 page 太寬或太窄 → Mitigation: page 內容保持 extractive 且 source-backed，不把 page 自動寫回 Joplin。
- [Risk] target notebook flag 降低 approve 前摩擦，也可能讓 operator 選錯 notebook → Mitigation: approve 前 draft 仍可審核，audit 可揭露 target 缺失或 unsafe target。
- [Risk] audit 規則增加 false positive → Mitigation: Error Book 是 local governance evidence，不自動修復、不阻擋 query/read。

## Migration Plan

- Existing raw cache and compiled notes remain readable.
- Next `wiki compile` rewrites page artifacts using the grouped page model.
- Existing drafts without target notebook remain valid pending drafts, but `wiki approve` continues to reject them until target is added.
- Rollback is deleting regenerated local artifacts under `compiled/`, `candidates/`, and `audit/`, then rerunning the previous implementation or restoring from git.

## Open Questions

- 是否要在下一個 change 支援從 Joplin notebook metadata 建立可讀 notebook title index，目前本 change 只使用 `parent_id`。
- 下一個自動化 change 要先做哪一層：背景排程、LLM-assisted draft quality、semantic retrieval，還是 Telegram／Discord ingestion bot？建議先選背景排程，因為它能自動串起現有 deterministic pipeline，且不引入新模型或資料庫風險。
