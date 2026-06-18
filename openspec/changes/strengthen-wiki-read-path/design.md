## Context

`build-hermes-wiki-engine` 已建立最小 read path：`wiki sync` 寫 raw metadata/body cache，`wiki compile` 產出 `compiled/notes.json`，`wiki query` 做本機 keyword search。下一步不是換 retrieval 架構，而是把這條 read path 從 demo 級推到可長期跑的最小穩定版。

先前 RAG 是硬體限制下的務實取捨：本機設備不夠跑穩定 LLM 時，用 retrieval layer 減少模型負擔。接 Hermes 後，目標改成 LLM Wiki tool-use：Hermes 透過 deterministic local tools 查、讀、沿 links 探索 Joplin 長期知識，而不是把這個 repo 做成 RAG framework。

成熟領域上，這是 agent-native knowledge system / retrieval-as-reasoning：ingestion completeness、normalization、lexical ranking、source attribution、link graph、wiki page compilation、audit loop、human-approved writeback。主流做法不是把 chunks 塞進 hidden retriever，而是把知識整理成可搜尋、可閱讀、可沿連結探索、可審核修正的 artifact。本 change 的完整方向是 LLM Wiki；落地順序仍維持 stdlib first，先把 deterministic read tools 做穩，再進入 source-backed synthesis 與 self-evolving loop。

## Goals / Non-Goals

**Goals:**

- 讓 `wiki sync` 可同步完整 Joplin notes pagination，而不是只抓第一頁。
- 讓 sync status 更可觀測：notes_seen、notes_written、pages_seen、warnings。
- 讓 malformed note 以 stable user-safe error 失敗，不寫出不可信 cache。
- 讓 `wiki query` 支援 top-N limit、title/body 權重、穩定 snippet、source metadata。
- 讓 `wiki compile` 產生最小 `graph/graph.json`，只包含 notebook parent relation 與 Markdown note links。
- 讓 `wiki read <note-id>` 能從本機 artifacts 讀回單頁 note 內容。
- 讓 `wiki links <note-id>` 能從本機 graph artifact 回傳鄰接 note / notebook links。
- 讓 `wiki query`、`wiki read`、`wiki links` 回傳 deterministic evidence sufficiency metadata。
- 讓 read path 對 Hermes 保持 wiki tool-use 形狀，不建立 RAG / vector retrieval 預設架構。
- 定義 source-backed wiki page model，讓 compiled wiki 可從 source notes 演進成 topic/entity pages。
- 讓 `wiki compile` 產生最小 page artifacts 與 page index，並保留 source note references。
- 讓 `wiki query`、`wiki read`、`wiki links` 同時支援 page refs 與 source note refs。
- 讓 `wiki audit` / Error Book 記錄 deterministic structural errors、missing links、unsupported claims 與 evidence gaps。
- 讓 Telegram、Discord、feedback、consolidation 只產生 filesystem drafts。
- 讓 `wiki approve <draft-id>` 成為唯一 Joplin writeback 入口，並要求 provenance、conflict check 與 explicit approval。

**Non-Goals:**

- 不新增 dependency。
- 不引入 RAG layer、embedding、vector DB、LLM summary、OCR 或 graph 推理。
- 不讓 page synthesis、capture、feedback 或 consolidation 直接寫回 Joplin。
- 不讓 Telegram / Discord capture 繞過 filesystem draft 與人工 approve。
- 不讓 foreground `wiki query`、`wiki read`、`wiki links` 呼叫 Joplin Data API、LLM、embedding service 或外部 API。
- 不新增 daemon、queue、HTTP server 或 LaunchDaemon。

## Decisions

### Phase 1: Joplin notes pagination and sync observability

`wiki sync` SHALL follow Joplin Data API pagination until there are no more pages. The raw cache remains filesystem-based: `raw/notes-metadata.json` plus `raw/notes/<note-id>.md`.

Alternative considered: keep `limit: 100` and rely on query misses to reveal gaps. That makes missing memory look like "資料不足" instead of a sync defect, so it is not acceptable.

### Phase 2: Lexical query improvements with stdlib only

`wiki query` SHALL stay a local lexical search over `compiled/notes.json`. It can improve scoring and snippets with simple stdlib functions, but SHALL NOT add ranking libraries, embeddings, or model calls.

Alternative considered: add vector search now. That is premature while corpus completeness, source metadata, and graph basics are still thin.

### Hermes uses local wiki tools instead of RAG

Hermes SHALL use this repo through deterministic local wiki tools and compiled artifacts. The read path MAY improve lexical search and graph traversal, but SHALL NOT introduce a RAG service, vector database, embedding pipeline, or model-dependent retrieval step in this change.

Alternative considered: keep the old RAG mental model. That was useful when local models were too expensive to run, but it now adds architecture cost without matching the Hermes command-bridge direction.

### Phase 3: Minimal graph and links from existing artifacts

`wiki compile` SHALL derive a small `graph/graph.json` from compiled notes. The graph is structural, not semantic: note nodes, notebook parent edges, and Markdown note-link edges only.

Alternative considered: LLM relation extraction. That is deferred because it is slower, harder to test, and risks inventing edges.

### Phase 4: Local note read tool

`wiki read <note-id>` SHALL read a single note from local compiled/raw artifacts. It SHALL NOT call Joplin Data API during foreground read. This makes Hermes wiki usage two-step: first query for candidate notes, then read source content by id.

Alternative considered: return full body in every query result. That makes query output too large and couples search with reading, so it is not the minimal Hermes tool shape.

### Phase 5: Link traversal tool

`wiki links <note-id>` SHALL read `graph/graph.json` and return directly adjacent graph relationships for the requested note. The command is a local graph lookup, not a semantic explorer.

Alternative considered: expose graph traversal only through `wiki query`. That hides the wiki shape from Hermes and makes link-following harder to reason about.

### Phase 6: Evidence sufficiency without LLM audit

Read-path commands SHALL return deterministic evidence metadata that tells Hermes whether the response is source-backed, insufficient, not found, or blocked by missing local artifacts. This SHALL be a protocol field, not an LLM judgment.

Alternative considered: add an LLM evidence auditor. That would create another model-dependent path before the deterministic read tools are stable.

### Phase 7: Source-backed wiki page model

Compiled wiki pages SHALL be source-backed artifacts, not free-form summaries. A page can represent a topic, entity, decision, workflow, or project, but every fact-bearing section SHALL keep source note references so Hermes can read the underlying evidence.

Alternative considered: keep only normalized Joplin notes forever. That is simpler, but it does not fully match LLM Wiki semantics because agents need stable topic/entity pages to browse and traverse.

### Phase 8: Synthesized page artifacts through compile

`wiki compile` SHALL be the only command that builds local page artifacts from raw and compiled source notes. It MAY produce minimal page files and a page index, but SHALL NOT write synthesized pages to Joplin.

Alternative considered: create pages during `wiki query`. That hides write-like work inside a foreground read command and makes cache state unpredictable.

### Phase 9: Page-aware traversal semantics

`wiki query`, `wiki read`, and `wiki links` SHALL use stable refs for both source notes and compiled pages. `wiki query` finds candidates, `wiki read` reads one ref, and `wiki links` follows local graph relationships; none of these commands SHALL answer the user directly.

Alternative considered: add `wiki ask` now. That would collapse search, reading, traversal, and answer generation into one tool before the wiki surface is testable.

### Phase 10: Deterministic audit and Error Book

`wiki audit` SHALL run deterministic checks over local artifacts and write Error Book entries for structural failures such as dangling links, missing source references, unsupported page claims, stale compiled artifacts, and evidence gaps. It SHALL NOT use LLM grading in this change.

Alternative considered: start with LLM fact-checking. That is more powerful but creates a second model-dependent path before structural correctness is stable.

### Phase 11: Draft-first capture, feedback, and consolidation

Telegram capture, Discord capture, user feedback, and consolidation SHALL enter the system only as filesystem drafts. Drafts are reviewable proposals with provenance and intended target, not long-term memory.

Alternative considered: write capture directly into Joplin inbox. That is faster but makes accidental long-term memory pollution likely.

### Phase 12: Approve-gated Joplin writeback

`wiki approve <draft-id>` SHALL be the only command allowed to write to Joplin. Approval SHALL require draft provenance, target notebook, conflict behavior, and an explicit operator action.

Alternative considered: let `wiki compile` or `wiki draft` write back after generation. That mixes local artifact generation with durable SSOT mutation.

## Implementation Contract

### Phase 1: Sync pagination

Observable behavior:

- `wiki sync` fetches all Joplin notes through pagination.
- Successful sync writes raw body files for every synced note and a compact metadata manifest.
- `status.json` records `notes_seen`, `notes_written`, `pages_seen`, and `warnings`.
- Malformed notes fail with stable JSON and do not silently write partial trusted metadata.

Data shape additions:

```json
{
  "ok": true,
  "state": "synced",
  "last_job": "sync",
  "notes_seen": 250,
  "notes_written": 250,
  "pages_seen": 3,
  "warnings": []
}
```

Acceptance criteria:

- Tests cover two or more pages.
- Tests cover malformed note id / missing body behavior.
- `wiki sync` still never prints tokens or secret env values.
- `wiki sync` still uses only Joplin Data API read operations.

### Phase 2: Query quality

Observable behavior:

- `wiki query "question"` returns at most a default top-N result count.
- Query scoring weights title matches higher than body matches.
- Result snippets are taken near the first matching term.
- Each result includes `id`, `title`, `parent_id`, `snippet`, and `score`.
- Query still returns `資料不足` with empty results when nothing matches.

Scope boundaries:

- In scope: stdlib scoring, top-N limit, stable snippets, source metadata.
- Out of scope: RAG service, embeddings, semantic reranking, LLM answer generation.

### Phase 3: Minimal graph

Observable behavior:

- `wiki compile` writes `graph/graph.json` in addition to `compiled/notes.json`.
- Graph nodes include synced notes.
- Graph edges include notebook parent edges and Markdown note-link edges when target note ids can be resolved.
- Graph generation is deterministic for the same compiled input.

Scope boundaries:

- In scope: local structural graph from known note ids and Markdown links.
- Out of scope: inferred relationships, topic extraction, ontology, LLM graph generation.

### Phase 4: Local note read

Observable behavior:

- `wiki read <note-id>` returns a single note from local artifacts.
- The command returns `id`, `title`, `parent_id`, `body_hash`, `plain_text`, and `source`.
- The command does not call Joplin Data API, embeddings, vector search, LLMs, or external retrieval APIs.
- Missing local artifacts or unknown note ids return stable JSON errors.

Data shape additions:

```json
{
  "ok": true,
  "id": "note-a",
  "title": "Local retrieval",
  "parent_id": "folder-1",
  "body_hash": "sha256:example",
  "plain_text": "Hermes wiki local retrieval works",
  "source": {
    "artifact": "compiled/notes.json",
    "raw_body": "raw/notes/note-a.md"
  },
  "evidence_status": "source_backed"
}
```

Scope boundaries:

- In scope: direct local note reads by id.
- Out of scope: synthesized pages, cross-note summarization, Joplin foreground reads, LLM answer generation.

### Phase 5: Link traversal

Observable behavior:

- `wiki links <note-id>` reads `graph/graph.json`.
- The command returns directly adjacent nodes and edges for the requested note.
- Missing graph artifact returns stable JSON with `evidence_status: "graph_missing"`.
- Unknown note id returns stable JSON with `evidence_status: "not_found"`.

Data shape additions:

```json
{
  "ok": true,
  "id": "note-a",
  "neighbors": [
    {
      "id": "note-b",
      "type": "note",
      "title": "Related note",
      "relation": "markdown_link"
    }
  ],
  "edges": [
    {
      "from": "note-a",
      "to": "note-b",
      "type": "markdown_link"
    }
  ],
  "evidence_status": "source_backed"
}
```

Scope boundaries:

- In scope: one-hop local graph lookup.
- Out of scope: multi-hop planning, semantic relation inference, ontology, graph database.

### Phase 6: Evidence sufficiency protocol

Observable behavior:

- `wiki query` returns `evidence_status: "source_backed"` when at least one local result is returned.
- `wiki query` returns `evidence_status: "insufficient"` when no local result matches.
- `wiki read` returns `evidence_status: "source_backed"` for known local notes and `evidence_status: "not_found"` for unknown ids.
- `wiki links` returns `evidence_status: "source_backed"` for known graph-backed neighbors, `evidence_status: "not_found"` for unknown ids, and `evidence_status: "graph_missing"` when the graph artifact does not exist.

Scope boundaries:

- In scope: deterministic protocol fields that Hermes can inspect.
- Out of scope: LLM confidence scoring, answer grading, fact verification, contradiction detection.

### Phase 7: Source-backed wiki page model

Observable behavior:

- Compiled page artifacts represent stable topic/entity wiki pages.
- Each page includes `page_id`, `title`, `aliases`, `tags`, `summary`, `sections`, `links`, and `sources`.
- Every fact-bearing page section references one or more source note ids.
- Pages are local compiled artifacts, not Joplin SSOT.

Data shape additions:

```json
{
  "page_id": "page-local-retrieval",
  "title": "Local retrieval",
  "aliases": ["wiki search"],
  "tags": ["hermes", "wiki"],
  "summary": "Source-backed overview of local retrieval behavior.",
  "sections": [
    {
      "heading": "Command semantics",
      "text": "wiki query finds candidates; wiki read loads source-backed content.",
      "sources": ["note-a"]
    }
  ],
  "links": ["page-hermes"],
  "sources": ["note-a", "note-b"]
}
```

Scope boundaries:

- In scope: minimal page JSON / Markdown artifacts with source references.
- Out of scope: unsourced summaries, ontology, graph inference, cloud LLM calls.

### Phase 8: Synthesized page artifacts through compile

Observable behavior:

- `wiki compile` can write `compiled/pages.json` and local page files in addition to note and graph artifacts.
- Page generation is rebuildable from raw cache and compiled source notes.
- `wiki compile` does not write Joplin, drafts, Error Book entries, or status beyond compile metadata.
- Unsupported page sections are either omitted or marked with evidence gaps for audit.

Scope boundaries:

- In scope: local source-backed page compilation.
- Out of scope: direct writeback, capture ingestion, answer generation, daemonized incremental compile.

### Phase 9: Page-aware traversal semantics

Observable behavior:

- Refs use explicit prefixes: `note:<id>` for source notes and `page:<id>` for compiled wiki pages.
- `wiki query` returns candidates with `ref`, `kind`, `title`, `snippet`, `score`, `sources`, and `evidence_status`.
- `wiki read <ref>` reads either a source note or a compiled page.
- `wiki links <ref>` returns one-hop local links for either a source note or a compiled page.
- `wiki query`, `wiki read`, and `wiki links` never generate final answers.

Scope boundaries:

- In scope: explicit ref semantics and page-aware local traversal.
- Out of scope: `wiki ask`, hidden retrieval, automatic multi-hop planning inside the engine.

### Phase 10: Deterministic audit and Error Book

Observable behavior:

- `wiki audit` checks local artifacts and writes `audit/error-book.json`.
- Error Book entries include `id`, `kind`, `ref`, `message`, `sources`, `status`, and `created_at`.
- Initial `kind` values include `dangling_link`, `missing_source`, `unsupported_claim`, `stale_artifact`, and `evidence_gap`.
- `wiki audit` returns counts by kind and never mutates Joplin.

Data shape additions:

```json
{
  "id": "err-001",
  "kind": "dangling_link",
  "ref": "page:local-retrieval",
  "message": "Page links to a missing page ref.",
  "sources": ["note-a"],
  "status": "open",
  "created_at": "2026-06-19T00:00:00.000Z"
}
```

Scope boundaries:

- In scope: deterministic structural and source-grounding checks.
- Out of scope: LLM fact grading, contradiction detection, automatic repair.

### Phase 11: Draft-first capture, feedback, and consolidation

Observable behavior:

- `wiki draft telegram`, `wiki draft discord`, `wiki draft feedback`, and `wiki draft consolidate` write reviewable filesystem drafts only.
- Drafts include `draft_id`, `kind`, `source`, `target`, `body`, `provenance`, `status`, and `created_at`.
- Draft commands do not write raw cache, compiled artifacts, graph, Error Book, status, or Joplin notes.

Scope boundaries:

- In scope: filesystem draft creation with provenance.
- Out of scope: automatic approval, automatic Joplin writeback, background capture listeners.

### Phase 12: Approve-gated Joplin writeback

Observable behavior:

- `wiki approve <draft-id>` reads one filesystem draft and writes to Joplin only after explicit operator invocation.
- Approval requires a target notebook, provenance, conflict behavior, and a stable success / failure JSON result.
- Failed approval leaves the draft available for review and does not delete local provenance.
- Successful approval records the Joplin note id in the draft metadata or an approval log.

Scope boundaries:

- In scope: single-draft approve through Joplin Data API.
- Out of scope: bulk approval, auto-approval, conflict auto-merge, direct writes from capture commands.

### Safety boundary for local reads and durable writes

Observable behavior:

- Foreground read commands remain local and non-mutating.
- Durable Joplin mutations only happen through `wiki approve <draft-id>`.
- Generated artifacts remain rebuildable from Joplin SSOT plus local drafts / approvals.

## Risks / Trade-offs

- [Risk] Joplin pagination edge cases can duplicate or skip notes. → Mitigation: test multi-page fixtures and stop only when the API page indicates no more items.
- [Risk] Lexical scoring remains naive. → Mitigation: keep it deterministic and source-backed; add semantic retrieval only after read path is trusted.
- [Risk] Graph links can be incomplete. → Mitigation: include only resolvable local note ids and keep unresolved links as warnings if needed.
- [Risk] Synthesized pages can introduce unsupported claims. → Mitigation: require source references per fact-bearing section and record unsupported claims in Error Book.
- [Risk] Capture and feedback can pollute long-term memory. → Mitigation: require filesystem draft first and approve-gated Joplin writeback.
- [Risk] This change is larger than a single read-path slice. → Mitigation: keep phases ordered; apply can stop after any green phase with no partial Joplin mutation.

## Migration Plan

1. Implement sync pagination first and verify raw cache completeness with tests.
2. Improve query scoring and source metadata after compiled notes remain stable.
3. Add minimal graph generation from compiled artifacts.
4. Add read, links, and evidence sufficiency so Hermes can traverse source notes.
5. Add source-backed page artifacts and page-aware traversal.
6. Add deterministic audit / Error Book.
7. Add draft-first capture, feedback, and consolidation.
8. Add approve-gated Joplin writeback.
9. Re-run `npm test`, CLI smoke, and `spectra validate --all`.

Rollback: revert this change; raw cache and compiled artifacts are rebuildable generated state, not Joplin SSOT.

## Open Questions

- Whether Joplin note links should support only internal note ids in this change, or also Joplin resource links. Default: note ids only.
