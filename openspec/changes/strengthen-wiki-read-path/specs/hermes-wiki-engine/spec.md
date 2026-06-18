## ADDED Requirements

### Requirement: Sync paginates Joplin notes

The Hermes Wiki Engine SHALL fetch every available Joplin note page during `wiki sync` instead of stopping after the first notes page.

#### Scenario: Multiple Joplin pages are synced

- **WHEN** Joplin Data API returns multiple notes pages during `wiki sync`
- **THEN** the engine writes raw metadata and body files for notes from every page
- **AND** `status.json` records the total notes seen and pages seen

##### Example: two pages

- **GIVEN** page 1 contains note `note-a` and indicates another page exists
- **AND** page 2 contains note `note-b` and indicates no more pages exist
- **WHEN** `wiki sync` runs
- **THEN** raw cache contains both `note-a` and `note-b`
- **AND** `status.json` records `notes_seen: 2` and `pages_seen: 2`

#### Scenario: Sync reports written note count

- **WHEN** `wiki sync` completes successfully
- **THEN** `status.json` records `notes_written`
- **AND** `notes_written` equals the number of raw body files written

### Requirement: Sync fails safely for malformed notes

The Hermes Wiki Engine SHALL reject malformed Joplin note records before writing trusted raw cache output.

#### Scenario: Unsafe note id is rejected

- **WHEN** Joplin Data API returns a note id that is not safe for local cache file names
- **THEN** `wiki sync` returns JSON with `ok` set to `false`
- **AND** the response contains stable code `JOPLIN_NOTE_ID_UNSAFE`
- **AND** no raw body file is written outside the raw notes directory

#### Scenario: Missing note body is rejected

- **WHEN** Joplin Data API returns a note without a string body
- **THEN** `wiki sync` returns JSON with `ok` set to `false`
- **AND** the response contains stable code `JOPLIN_NOTE_BODY_MISSING`

### Requirement: Query ranks lexical matches deterministically

The Hermes Wiki Engine SHALL rank local query results with deterministic lexical scoring over `compiled/notes.json`.

#### Scenario: Title matches outrank body-only matches

- **WHEN** two compiled notes match the query and only one note matches in the title
- **THEN** `wiki query` returns the title-matching note before the body-only note

##### Example: title weight

- **GIVEN** note `a` has title `Local retrieval` and plain text `Hermes wiki`
- **AND** note `b` has title `Other` and plain text `Local retrieval`
- **WHEN** the operator runs `wiki query "local retrieval"`
- **THEN** note `a` appears before note `b`

#### Scenario: Query limits result count

- **WHEN** more compiled notes match than the default result limit
- **THEN** `wiki query` returns no more than the default limit

#### Scenario: Query result includes source metadata

- **WHEN** a compiled note matches a query
- **THEN** each query result includes note id, title, parent id, snippet, and score

##### Example: result shape

- **GIVEN** compiled note `note-a` has title `Local retrieval`, parent id `folder-1`, and plain text `Hermes wiki local retrieval works`
- **WHEN** the operator runs `wiki query "local retrieval"`
- **THEN** the first result contains `id: "note-a"`, `title: "Local retrieval"`, `parent_id: "folder-1"`, a snippet containing `local retrieval`, and numeric `score`

### Requirement: Hermes uses local wiki tools instead of RAG

The Hermes Wiki Engine SHALL expose deterministic local wiki artifacts and commands for Hermes. It MUST NOT introduce a RAG service, vector database, embedding pipeline, or model-dependent retrieval step as part of read path hardening.

#### Scenario: Query remains local and deterministic

- **WHEN** an operator runs `wiki query "example"`
- **THEN** the command reads completed local artifacts
- **AND** it does not call an embedding service, vector database, LLM, or external retrieval API

#### Scenario: Compile remains model-free

- **WHEN** an operator runs `wiki compile`
- **THEN** the command derives compiled notes and graph artifacts from local raw cache
- **AND** it does not call an LLM, embedding model, or vector index

### Requirement: Compile produces a minimal graph artifact

The Hermes Wiki Engine SHALL derive a deterministic local graph artifact from compiled notes without semantic inference.

#### Scenario: Compile writes graph file

- **WHEN** `wiki compile` completes successfully
- **THEN** the engine writes `graph/graph.json`

#### Scenario: Graph includes note nodes

- **WHEN** compiled notes contain note ids and titles
- **THEN** `graph/graph.json` contains one note node for each compiled note

#### Scenario: Graph includes notebook parent edges

- **WHEN** a compiled note has `parent_id`
- **THEN** `graph/graph.json` contains an edge from the note to that parent notebook id

#### Scenario: Graph includes resolvable Markdown note links

- **WHEN** a raw or compiled note body links to another known note id
- **THEN** `graph/graph.json` contains a note-to-note link edge for that resolvable target

### Requirement: Read returns a local note by id

The Hermes Wiki Engine SHALL expose `wiki read <note-id>` as a deterministic local command that returns one note from compiled or raw artifacts without calling Joplin Data API.

#### Scenario: Known note is read from local artifacts

- **GIVEN** compiled artifacts contain note `note-a`
- **WHEN** the operator runs `wiki read note-a`
- **THEN** the command returns JSON with `ok` set to `true`
- **AND** the response includes note id, title, parent id, body hash, note text, source artifact metadata, and `evidence_status: "source_backed"`

#### Scenario: Unknown note id returns not found evidence status

- **WHEN** the operator runs `wiki read missing-note`
- **THEN** the command returns JSON with `ok` set to `false`
- **AND** the response contains stable code `NOTE_NOT_FOUND`
- **AND** the response contains `evidence_status: "not_found"`

#### Scenario: Read remains foreground local only

- **WHEN** the operator runs `wiki read note-a`
- **THEN** the command reads local artifacts
- **AND** it does not call Joplin Data API, an embedding service, a vector database, an LLM, or an external retrieval API

### Requirement: Links return local graph neighbors

The Hermes Wiki Engine SHALL expose `wiki links <note-id>` as a deterministic local graph lookup over `graph/graph.json`.

#### Scenario: Known note returns adjacent graph relationships

- **GIVEN** `graph/graph.json` contains an edge from `note-a` to `note-b`
- **WHEN** the operator runs `wiki links note-a`
- **THEN** the command returns JSON with `ok` set to `true`
- **AND** the response includes adjacent neighbors, matching edges, and `evidence_status: "source_backed"`

#### Scenario: Missing graph artifact is reported explicitly

- **WHEN** the operator runs `wiki links note-a` before `graph/graph.json` exists
- **THEN** the command returns JSON with `ok` set to `false`
- **AND** the response contains stable code `GRAPH_NOT_FOUND`
- **AND** the response contains `evidence_status: "graph_missing"`

#### Scenario: Unknown graph note returns not found evidence status

- **WHEN** the operator runs `wiki links missing-note`
- **THEN** the command returns JSON with `ok` set to `false`
- **AND** the response contains stable code `NOTE_NOT_FOUND`
- **AND** the response contains `evidence_status: "not_found"`

### Requirement: Read path reports evidence sufficiency

The Hermes Wiki Engine SHALL report deterministic evidence sufficiency metadata from read-path commands so Hermes can decide whether to continue searching, read a note, traverse links, or report insufficient data.

#### Scenario: Query with matches is source-backed

- **WHEN** `wiki query "local retrieval"` returns one or more local results
- **THEN** the response contains `evidence_status: "source_backed"`
- **AND** the response includes source-backed result metadata

#### Scenario: Query without matches is insufficient

- **WHEN** `wiki query "missing topic"` finds no local results
- **THEN** the response contains `evidence_status: "insufficient"`
- **AND** the response still returns the existing insufficient-data message

#### Scenario: Evidence protocol remains deterministic

- **WHEN** `wiki query`, `wiki read`, or `wiki links` reports `evidence_status`
- **THEN** the value is derived only from local artifact availability and matched local sources
- **AND** it is not derived from LLM confidence, semantic grading, or external verification

### Requirement: Wiki page synthesis remains deferred

The Hermes Wiki Engine SHALL NOT create synthesized topic or entity wiki pages during read path hardening.

#### Scenario: Compile remains note-index based

- **WHEN** `wiki compile` runs
- **THEN** the engine writes compiled note and graph artifacts only
- **AND** it does not create topic pages, entity pages, cross-note summaries, or synthesized wiki documents

#### Scenario: Read returns source note content

- **WHEN** `wiki read <note-id>` runs
- **THEN** the command returns local source note content
- **AND** it does not synthesize a new wiki page from multiple notes

### Requirement: Self-evolving memory loop remains deferred

The Hermes Wiki Engine SHALL keep self-evolving memory workflows non-mutating during read path hardening.

#### Scenario: No feedback or consolidation write is performed

- **WHEN** `wiki query`, `wiki read`, `wiki links`, or `wiki compile` runs
- **THEN** the command does not write Error Book entries, feedback records, consolidation drafts, approved memory, or Joplin notes

#### Scenario: Capture and approve stay deferred

- **WHEN** an operator runs `wiki draft telegram`, `wiki draft discord`, or `wiki approve example-draft`
- **THEN** the command returns stable not implemented JSON
- **AND** it does not write Error Book entries, feedback records, consolidation drafts, approved memory, or Joplin notes

### Requirement: Capture and writeback remain deferred during read path hardening

The Hermes Wiki Engine SHALL keep capture and writeback commands non-mutating while read path hardening is implemented.

#### Scenario: Draft commands remain non-mutating

- **WHEN** an operator runs `wiki draft telegram` or `wiki draft discord`
- **THEN** the command returns stable not implemented JSON
- **AND** it does not write raw cache, compiled index, graph, status, or Joplin notes

#### Scenario: Approve command remains non-mutating

- **WHEN** an operator runs `wiki approve example-draft`
- **THEN** the command returns stable not implemented JSON
- **AND** it does not write Joplin notes
