## Context

`wiki draft consolidate` 目前已具備 review-gated writeback 架構：draft 會落在本機 filesystem，保留 provenance refs，並由 `wiki approve` 才能寫回 Joplin。live runtime 實測已確認 sync、compile、draft、audit、approve、read-back 全鏈路可用，但也暴露出整理稿內容只等於操作者輸入的目標句，沒有使用來源筆記內容。

這次補點屬於成熟的知識管理與 content curation pipeline。主流做法會把「來源擷取」、「整理草稿」、「人工審核」、「正式沉澱」拆開。此 repo 已有基本 writeback gate，因此這次把全筆記庫自動整理拆成同一 change 內的分期交付：Phase 1 補 deterministic source extraction；Phase 2 做全庫候選產生與批次 draft；Phase 3 做本機審核治理與可追溯沉澱。

## Goals / Non-Goals

**Goals:**

- 在同一個 change 內分期交付全筆記庫自動整理能力，讓每一 phase 都能用本機 artifacts 驗證。
- 讓 `wiki draft consolidate --ref ... "整理目的"` 從已完成的本機 artifacts 讀來源內容，產生可審核整理稿。
- 讓 operator 能從全庫 compiled artifacts 產生 bounded candidate list，並將候選轉成批次 review drafts。
- 讓 operator 能用本機審核治理 artifacts 追蹤 pending、approved、rejected、rollback evidence。
- 草稿內容必須包含整理目的、來源 refs、來源標題與本機摘錄，讓操作者能判斷是否值得 approve。
- 來源不存在時必須 fail closed，不建立無來源支撐的 consolidation draft。
- 保持 `draft` 階段不寫 Joplin、不呼叫 Joplin API、不呼叫 LLM、不改 compiled artifacts。

**Non-Goals:**

- 不做 abstractive LLM summary、主題聚類、語意去重、embedding retrieval 或跨筆記推理。
- 不新增 CLI 指令或新 package。
- 不改 `approve` 的 Data API writeback 行為。
- 不新增排程常駐背景 job；全庫整理先由 operator 主動執行本機 command。
- 不解決已寫回測試筆記內容太短的既有資料；這次只改後續 draft 生成。

## Decisions

### Split full-library automation into explicit phases

全筆記庫自動整理 SHALL be delivered in staged implementation inside this change:

- Phase 1: source-backed consolidation drafts for explicit refs.
- Phase 2: full-library candidate discovery from compiled artifacts, producing candidate refs or review drafts without Joplin writeback.
- Phase 3: review queue governance, batch approval policy, quality checks, and rollback evidence.

替代方案是現在新增 `wiki organize --all` 或背景 job，但它會同時改變 retrieval、batch processing、operator review、writeback governance，超出這個 repo 目前最小可靠邊界。

### Add a bounded full-library candidate command

Phase 2 SHALL add a local operator command or subcommand that reads only compiled artifacts and writes a bounded candidate artifact. The command SHALL support a dry-run style output by default, use deterministic heuristics, and cap output size so a 5805-note compiled index does not create unreviewable drafts.

Candidate records SHALL include candidate id, source refs, reason, score or priority bucket, and proposed consolidation goal. Candidate discovery SHALL NOT call Joplin Data API, LLMs, embedding services, vector databases, or external retrieval APIs.

### Convert accepted candidates into review drafts

Phase 2 SHALL let an operator create consolidation drafts from selected candidates. The generated drafts SHALL reuse the Phase 1 source-backed content formatter and preserve provenance refs. Batch draft creation SHALL write only to `drafts/` and SHALL NOT approve or write Joplin notes.

### Track review governance with local artifacts

Phase 3 SHALL add local review-state artifacts for pending, approved, rejected, and rollback evidence. The artifacts SHALL be auditable by `wiki audit` and SHALL preserve which candidate or draft led to each approved Joplin note id. Approval remains gated by `wiki approve`; batch governance can prepare approvals but SHALL NOT bypass the review gate.

### Generate consolidation content from compiled local artifacts

`draft consolidate` SHALL resolve each `--ref` from local compiled artifacts before writing a draft。`note:<id>` 從 `compiled/notes.json` 取 `title`、`plain_text`、`parent_id`；`page:<id>` 從 `compiled/pages.json` 或 `compiled/pages/<id>.json` 取 page title、summary、sections。找不到任何 ref 時直接回穩定錯誤。

替代方案是 approve 前才整理內容，但那會把整理和寫回綁在一起，破壞 review-gated 邊界。

### Use deterministic extractive formatting as the first version

整理稿使用固定 Markdown 格式：第一行保留操作者輸入的整理目的作為草稿標題，後續包含 `## Sources` 與 `## Extracted notes`。每個來源輸出 ref、title、短摘錄。摘錄用 stdlib 字串處理，限制長度，避免把超長原文整篇塞進 draft。

替代方案是引入 LLM 摘要，但目前需求是補上可驗證自動整理能力；LLM 品質、成本、隱私與重試策略應留到下一個 change。

### Keep draft creation read-only toward durable stores

`draft consolidate` 只能讀 `compiled/` artifacts 並寫 `drafts/`。它 SHALL NOT 讀 Joplin Data API、raw cache、外部網路、模型服務，也 SHALL NOT 修改 raw、compiled、graph、audit、status 或 Joplin notes。

替代方案是直接讀 raw body 取得更完整內容；但 compiled artifacts 才是 Hermes 前台可用的穩定讀取面，這次應維持同一個知識讀取邊界。

## Implementation Contract

Behavior:

- This change delivers full-library automation in three phases: explicit refs become source-backed review drafts, compiled artifacts produce bounded candidates, selected candidates become review drafts, and review artifacts track approval outcomes.
- `wiki draft consolidate --ref note:note-a "整理目的"` 成功時，draft `content` SHALL NOT 等於單獨的 `整理目的` 字串。
- Draft `content` SHALL contain the operator goal, each accepted source ref, each source title when available, and a bounded excerpt or summary from the source artifact。
- Draft `provenance.refs` SHALL preserve the exact accepted refs in input order。
- Draft creation SHALL remain pending review and SHALL NOT write Joplin。
- Full-library candidate discovery SHALL produce bounded candidate artifacts from compiled notes/pages.
- Candidate-to-draft creation SHALL produce reviewable filesystem drafts without approve/writeback.
- Review governance SHALL record candidate, draft, approval, rejection, and rollback evidence locally.

Data shape:

- Existing draft JSON fields remain compatible: `draft_id`, `kind`, `status`, `created_at`, `content`, `provenance`, `intended_target`。
- `content` is Markdown-like text suitable for Joplin writeback after approve。
- Candidate artifacts contain `candidate_id`, `refs`, `reason`, `priority`, `goal`, and `status`。
- Review artifacts contain `draft_id`, `candidate_id`, `decision`, `joplin_note_id` when approved, and timestamp fields。

Failure modes:

- If a provided ref is syntactically unsafe, keep returning `DRAFT_REF_UNSAFE` before any file write。
- If a safe ref cannot be resolved from compiled artifacts, return `ok: false` with stable code `DRAFT_SOURCE_MISSING` and do not write a draft。
- If compiled artifacts required for a ref kind are missing, return `DRAFT_SOURCE_MISSING` and do not write a draft。
- If full-library candidate discovery runs without compiled artifacts, return a stable local-artifact missing error and do not write candidates。
- If candidate-to-draft creation references an unknown candidate id, return a stable candidate missing error and do not write drafts。

Acceptance criteria:

- Add or update `node:test` coverage showing consolidation content includes source title and excerpt for a compiled note。
- Add coverage showing missing compiled source returns `DRAFT_SOURCE_MISSING` and no draft file is created。
- Add coverage proving `draft consolidate` still does not call Joplin or mutate raw, compiled, graph, audit, or status artifacts。
- Add coverage showing full-library candidate discovery returns bounded candidates from compiled artifacts without writing Joplin。
- Add coverage showing candidate-to-draft creation creates reviewable drafts and keeps approve gated。
- Add coverage showing review governance artifacts record approved or rejected outcomes and are surfaced by audit。
- Run `node --test` and `spectra analyze generate-source-backed-consolidation-drafts --json` before archive.

Scope boundaries:

- In scope: `src/wiki.js`, `test/wiki.test.js`, `packaging/hermes/skills/wiki/SKILL.md`, `docs/design.md`, and the delta spec。
- Out of scope: new dependencies, LLM integration, Joplin notebook selection UX, scheduled background jobs, and live runtime deployment scripts。

## Risks / Trade-offs

- Deterministic excerpts can be lower quality than LLM summaries。→ Mitigation: label this as extractive review draft and preserve source refs for human review。
- Large source notes can create overly long drafts。→ Mitigation: bound excerpts per source with a simple character limit。
- Page and note refs have different artifact shapes。→ Mitigation: implement small local resolver helpers per ref kind without introducing new abstractions beyond what tests require。
- 同一 change 變大，可能增加 implementation risk。→ Mitigation: tasks are split into Phase 1, Phase 2, Phase 3 and each phase has its own tests before final validation。
