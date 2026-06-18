## Context

`build-hermes-wiki-engine` 已建立最小 read path：`wiki sync` 寫 raw metadata/body cache，`wiki compile` 產出 `compiled/notes.json`，`wiki query` 做本機 keyword search。下一步不是換 retrieval 架構，而是把這條 read path 從 demo 級推到可長期跑的最小穩定版。

先前 RAG 是硬體限制下的務實取捨：本機設備不夠跑穩定 LLM 時，用 retrieval layer 減少模型負擔。接 Hermes 後，目標改成 LLM Wiki tool-use：Hermes 透過 deterministic local tools 查、讀、沿 links 探索 Joplin 長期知識，而不是把這個 repo 做成 RAG framework。

成熟領域上，這是 retrieval / search pipeline hardening：ingestion completeness、normalization、lexical ranking、source attribution、link graph。主流做法會先確保 raw corpus 完整與可重建，再改 ranking，最後才加 graph 或 semantic retrieval。本 change 仍維持 stdlib lexical retrieval，不引入 RAG layer、embedding / vector DB。

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
- 明確保留 page synthesis、self-evolving loop、capture / writeback deferred boundary。

**Non-Goals:**

- 不新增 dependency。
- 不引入 RAG layer、embedding、vector DB、LLM summary、OCR 或 graph 推理。
- 不實作 topic/entity wiki page synthesis。
- 不實作 self-evolving memory loop、Error Book、feedback 或 consolidation。
- 不實作 Telegram / Discord capture。
- 不實作 Joplin writeback、`wiki approve` 或 conflict resolution。
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

### Phase 7: Page synthesis and self-evolving loop stay deferred

Topic/entity wiki page synthesis, Error Book, feedback capture, consolidation, Telegram / Discord capture, Joplin writeback, and `wiki approve` SHALL remain out of scope. This change strengthens deterministic read and traversal tools only.

Alternative considered: add synthesized topic pages after graph generation. That would mix read-path hardening with knowledge curation policy and should be handled by a later change after local tools are trustworthy.

### Deferred capture and writeback boundary

Telegram, Discord, Joplin writeback, and `wiki approve` SHALL remain out of scope. This change strengthens read path only.

Alternative considered: add `wiki draft discord` immediately after query improves. That would mix read-path stability with write-path governance and review risk.

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

### Phase 7: Deferred synthesis / self-evolving boundary

Observable behavior:

- No command creates topic/entity synthesized wiki pages in this change.
- No command writes Error Book entries, feedback records, consolidated notes, or approved memory back to Joplin in this change.
- `wiki draft telegram`, `wiki draft discord`, and `wiki approve` remain stable not implemented JSON.

### Deferred capture / writeback boundary

Observable behavior:

- `wiki draft telegram`, `wiki draft discord`, and `wiki approve` remain stable not implemented JSON.
- Tests continue to prove those commands do not write Joplin, raw cache, compiled index, graph, or status.

## Risks / Trade-offs

- [Risk] Joplin pagination edge cases can duplicate or skip notes. → Mitigation: test multi-page fixtures and stop only when the API page indicates no more items.
- [Risk] Lexical scoring remains naive. → Mitigation: keep it deterministic and source-backed; add semantic retrieval only after read path is trusted.
- [Risk] Graph links can be incomplete. → Mitigation: include only resolvable local note ids and keep unresolved links as warnings if needed.
- [Risk] Captures are tempting to implement next. → Mitigation: keep writeback out of this change and require a separate Spectra change for capture/writeback.

## Migration Plan

1. Implement sync pagination first and verify raw cache completeness with tests.
2. Improve query scoring and source metadata after compiled notes remain stable.
3. Add minimal graph generation from compiled artifacts.
4. Re-run `npm test`, CLI smoke, and `spectra validate --all`.

Rollback: revert this change; raw cache and compiled artifacts are rebuildable generated state, not Joplin SSOT.

## Open Questions

- Whether Joplin note links should support only internal note ids in this change, or also Joplin resource links. Default: note ids only.
