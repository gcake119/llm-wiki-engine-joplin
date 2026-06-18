# hermes-wiki-engine Specification

## Purpose

TBD - created by archiving change 'build-hermes-wiki-engine'. Update Purpose after archive.

## Requirements

### Requirement: Wiki command bridge exposes stable commands

The Hermes Wiki Engine SHALL expose a local `wiki` command bridge with stable command names for status, sync, compile, query, draft, and approve operations.

#### Scenario: Help lists supported commands

- **WHEN** an operator runs `wiki` with no supported command
- **THEN** the command output lists `status`, `sync`, `compile`, `query`, `draft`, and `approve`

#### Scenario: Unsupported command returns help

- **WHEN** an operator runs `wiki unknown-command`
- **THEN** the command output shows usage help instead of starting a job


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Status reports current knowledge engine state

The Hermes Wiki Engine SHALL report its current state as JSON without requiring Joplin, Telegram, Discord, or model services to be available.

#### Scenario: Fresh workspace has no status file

- **WHEN** an operator runs `wiki status` before any sync or compile job has completed
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `new`, and a user-safe message that tells the operator to run sync or compile

#### Scenario: Existing status file is returned

- **WHEN** `status.json` exists in the configured state directory
- **THEN** `wiki status` returns the persisted status JSON


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Sync uses Joplin Data API preflight

The Hermes Wiki Engine SHALL use Joplin Data API as the only Joplin integration boundary for sync operations. It MUST NOT read the main user's Joplin SQLite database or Joplin profile files directly.

#### Scenario: Missing token fails safely

- **WHEN** an operator runs `wiki sync` without a configured Joplin Data API token
- **THEN** the command returns JSON with `ok` set to `false`, a stable missing-token code, and no token value

#### Scenario: Unreachable Joplin API fails safely

- **WHEN** an operator runs `wiki sync` and the configured Joplin Data API endpoint is unreachable
- **THEN** the command returns JSON with `ok` set to `false`, a stable unavailable-api code, and a user-safe message

#### Scenario: Successful sync writes raw metadata cache

- **WHEN** Joplin Data API is reachable and authentication succeeds
- **THEN** `wiki sync` writes a raw metadata cache containing note id, title, parent id, updated time, and body hash for each synced note


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Sync stores raw note bodies for later compile

The Hermes Wiki Engine SHALL store synced Joplin note bodies in the raw cache so compile and query phases can run from local files without calling Joplin during foreground retrieval.

#### Scenario: Successful sync writes note body files

- **WHEN** Joplin Data API returns note bodies during `wiki sync`
- **THEN** the engine writes each body to `raw/notes/<note-id>.md`

#### Scenario: Metadata manifest stays compact

- **WHEN** `wiki sync` writes `raw/notes-metadata.json`
- **THEN** the manifest contains note id, title, parent id, updated time, and body hash
- **AND** it does not duplicate the full note body

#### Scenario: Raw body sync remains read-only against Joplin

- **WHEN** `wiki sync` stores raw note bodies
- **THEN** it uses Joplin Data API read operations only
- **AND** it does not create, update, or delete Joplin notes


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Jobs use a single lock and observable status

The Hermes Wiki Engine SHALL prevent concurrent sync or compile jobs with a single lock file and SHALL publish job results through `status.json`.

#### Scenario: Sync refuses to start when busy

- **WHEN** an operator runs `wiki sync` while a lock file indicates another job is running
- **THEN** the command returns JSON with `ok` set to `false`, `code` set to `WIKI_BUSY`, and no new sync job starts

#### Scenario: Successful sync updates status

- **WHEN** `wiki sync` completes successfully
- **THEN** `status.json` records `ok`, `state`, `last_job`, `started_at`, `finished_at`, `notes_seen`, and `warnings`


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Compile builds a thin local index

The Hermes Wiki Engine SHALL compile raw cached notes into the smallest local index needed for source-backed keyword retrieval.

#### Scenario: Compile reads only raw cache

- **WHEN** an operator runs `wiki compile`
- **THEN** the command reads `raw/notes-metadata.json` and `raw/notes/*.md`
- **AND** it does not call Joplin Data API

#### Scenario: Missing raw cache fails safely

- **WHEN** an operator runs `wiki compile` before raw cache exists
- **THEN** the command returns JSON with `ok` set to `false`, a stable missing-raw-cache code, and a user-safe message

#### Scenario: Compile writes notes index

- **WHEN** raw cache exists and compile succeeds
- **THEN** the command writes `compiled/notes.json`
- **AND** each compiled note contains id, title, parent id, updated time, body hash, and plain text

#### Scenario: Compile updates status

- **WHEN** `wiki compile` completes successfully
- **THEN** `status.json` records a successful compile job and the number of compiled notes


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: Foreground query reads completed local memory

The Hermes Wiki Engine SHALL answer memory queries from completed local cache, graph, or index data. It SHALL NOT trigger full-library compile during a foreground Hermes query.

#### Scenario: Query command requires a question

- **WHEN** an operator runs `wiki query` without a question
- **THEN** the command returns a user-facing message asking for a question

#### Scenario: Query without implementation remains explicit

- **WHEN** `wiki query "example"` is run before the retrieval slice is implemented
- **THEN** the command returns stable JSON indicating that the query contract exists but retrieval is not implemented yet

#### Scenario: Query reads compiled notes index

- **WHEN** an operator runs `wiki query "example"` after `compiled/notes.json` exists
- **THEN** the command searches the compiled local index
- **AND** it does not call Joplin Data API

#### Scenario: Query returns source-backed results

- **WHEN** local keyword search finds matching compiled notes
- **THEN** the command returns note id, title, snippet, and score for each result

#### Scenario: Query reports insufficient data

- **WHEN** local keyword search finds no matching compiled note
- **THEN** the command returns a user-facing `資料不足` response instead of inventing an answer

#### Scenario: Query requires compiled index

- **WHEN** an operator runs `wiki query "example"` before `compiled/notes.json` exists
- **THEN** the command returns a stable user-safe error that tells the operator to run `wiki compile`


<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
### Requirement: System notifications use Discord webhook safely

The Hermes Wiki Engine SHALL send system notifications to Discord through the configured system webhook. It MUST NOT print the webhook URL or token value in command output.

#### Scenario: Notify command sends a Discord system message

- **WHEN** an operator runs `wiki notify discord --message "example"` with a valid `DISCORD_SYSTEM_WEBHOOK_URL`
- **THEN** the command posts the message to the configured Discord webhook
- **AND** the command returns JSON with `ok` set to `true`, `state` set to `notified`, and `target` set to `discord_system`
- **AND** the command output does not include the webhook URL

#### Scenario: Missing webhook fails safely

- **WHEN** an operator runs `wiki notify discord --message "example"` without `DISCORD_SYSTEM_WEBHOOK_URL`
- **THEN** the command returns JSON with `ok` set to `false`, a stable missing-webhook code, and no secret value

#### Scenario: Webhook failure is user-safe

- **WHEN** Discord webhook delivery fails
- **THEN** the command returns JSON with `ok` set to `false`, a stable notification-failed code, and no stack trace or webhook URL

#### Scenario: Sync can notify system status explicitly

- **WHEN** an operator runs `wiki sync --notify`
- **THEN** the command runs the normal sync behavior
- **AND** it sends a system notification summarizing sync success or failure
- **AND** the primary sync result remains visible in command output
- **AND** the command output does not include the webhook URL

#### Scenario: Compile can notify system status explicitly

- **WHEN** an operator runs `wiki compile --notify`
- **THEN** the command runs the normal compile behavior
- **AND** it sends a system notification summarizing compile success or failure
- **AND** the primary compile result remains visible in command output
- **AND** the command output does not include the webhook URL

---
### Requirement: Capture sources write drafts before Joplin writeback

The Hermes Wiki Engine SHALL treat Telegram and Discord as capture sources. It MUST write capture output to filesystem drafts before any Joplin writeback.

#### Scenario: Draft command remains explicit before capture implementation

- **WHEN** an operator runs `wiki draft telegram` or `wiki draft discord` before capture implementation exists
- **THEN** the command returns stable JSON indicating that the draft contract exists but capture is not implemented yet

#### Scenario: Approve command remains explicit before writeback implementation

- **WHEN** an operator runs `wiki approve example-draft` before approve implementation exists
- **THEN** the command returns stable JSON indicating that approve writeback is not implemented yet

<!-- @trace
source: build-hermes-wiki-engine
updated: 2026-06-18
code:
  - .agents/skills/spectra-archive/SKILL.md
  - .agents/skills/spectra-debug/SKILL.md
  - AGENTS.md
  - src/wiki.js
  - .agents/skills/spectra-ask/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/tasks.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .agents/skills/spectra-drift/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/design.md
  - docs/spectra/build-hermes-wiki-engine/proposal.md
  - .agents/skills/spectra-propose/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/specs/hermes-wiki-engine/spec.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - docs/spectra/build-hermes-wiki-engine/.openspec.yaml
  - .agents/skills/spectra-discuss/SKILL.md
  - .spectra.yaml
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
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


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Compile produces source-backed wiki pages

The Hermes Wiki Engine SHALL compile source-backed topic or entity wiki page artifacts from local raw and compiled source notes.

#### Scenario: Compile writes page artifacts

- **WHEN** `wiki compile` runs
- **THEN** the engine writes local page artifacts and a page index
- **AND** each compiled page includes page id, title, aliases, tags, summary, sections, links, and source note references

#### Scenario: Fact-bearing page sections keep source references

- **WHEN** a compiled wiki page contains a fact-bearing section
- **THEN** that section includes one or more source note ids
- **AND** the page can be traced back to local source notes

##### Example: section sources

- **GIVEN** compiled page `page-local-retrieval` has section `Command semantics`
- **AND** the section text states that `wiki query` finds candidates and `wiki read` loads source-backed content
- **WHEN** the page artifact is inspected
- **THEN** that section contains `sources: ["note-a"]`

#### Scenario: Compile does not write synthesized pages to Joplin

- **WHEN** `wiki compile` produces source-backed wiki pages
- **THEN** the command writes only local artifacts
- **AND** it does not write synthesized pages to Joplin


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Read path supports page-aware refs

The Hermes Wiki Engine SHALL use explicit local refs so Hermes can distinguish source notes from compiled wiki pages during search, read, and link traversal.

#### Scenario: Query returns typed refs

- **WHEN** `wiki query "local retrieval"` returns local candidates
- **THEN** each result includes a `ref`
- **AND** each result identifies whether the ref is a source note or compiled page

#### Scenario: Read accepts note and page refs

- **WHEN** the operator runs `wiki read note:note-a`
- **THEN** the command reads a local source note
- **WHEN** the operator runs `wiki read page:local-retrieval`
- **THEN** the command reads a local compiled page

#### Scenario: Links accepts note and page refs

- **WHEN** the operator runs `wiki links note:note-a` or `wiki links page:local-retrieval`
- **THEN** the command returns one-hop local graph relationships for that ref


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Audit writes deterministic Error Book entries

The Hermes Wiki Engine SHALL expose `wiki audit` to record deterministic local artifact errors in an Error Book without using LLM grading.

#### Scenario: Audit records structural errors

- **WHEN** local artifacts contain a dangling link, missing source reference, unsupported page claim, stale artifact, or evidence gap
- **THEN** `wiki audit` writes an Error Book entry with id, kind, ref, message, sources, status, and created timestamp

#### Scenario: Audit reports counts by kind

- **WHEN** `wiki audit` completes
- **THEN** the command returns JSON with total error count and counts grouped by kind

#### Scenario: Audit remains local and non-mutating toward Joplin

- **WHEN** `wiki audit` runs
- **THEN** it reads and writes only local audit artifacts
- **AND** it does not write Joplin notes or call an LLM


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Draft commands create filesystem drafts

The Hermes Wiki Engine SHALL route Telegram capture, Discord capture, feedback, and consolidation into reviewable filesystem drafts before any durable Joplin writeback.

#### Scenario: Capture commands create reviewable drafts

- **WHEN** an operator runs `wiki draft telegram` or `wiki draft discord` with local input
- **THEN** the command writes a filesystem draft with draft id, kind, source, target, body, provenance, status, and created timestamp
- **AND** it does not write Joplin notes

#### Scenario: Feedback creates a reviewable draft

- **WHEN** an operator runs `wiki draft feedback`
- **THEN** the command writes a filesystem draft with provenance and intended target
- **AND** it does not write raw cache, compiled pages, graph, Error Book, or Joplin notes

#### Scenario: Consolidation creates a reviewable draft

- **WHEN** an operator runs `wiki draft consolidate`
- **THEN** the command writes a filesystem draft with provenance, source refs, and intended target
- **AND** it does not write raw cache, compiled pages, graph, Error Book, or Joplin notes


<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Approve gates Joplin writeback

The Hermes Wiki Engine SHALL make `wiki approve <draft-id>` the only command that can write approved memory back to Joplin.

#### Scenario: Approved draft writes to Joplin through Data API

- **GIVEN** a filesystem draft has provenance, target notebook, and conflict behavior
- **WHEN** the operator runs `wiki approve <draft-id>`
- **THEN** the command writes the approved content through Joplin Data API
- **AND** it returns stable JSON with the Joplin note id

#### Scenario: Approval failure keeps draft reviewable

- **WHEN** Joplin writeback fails during `wiki approve <draft-id>`
- **THEN** the command returns stable JSON with `ok` set to `false`
- **AND** the local draft and provenance remain available for review

#### Scenario: Non-approve commands do not write Joplin

- **WHEN** `wiki sync`, `wiki compile`, `wiki query`, `wiki read`, `wiki links`, `wiki audit`, or `wiki draft` runs
- **THEN** the command does not write Joplin notes

<!-- @trace
source: strengthen-wiki-read-path
updated: 2026-06-19
code:
  - docs/superpowers/plans/2026-06-18-discord-personal-server-channel-rollout.md
  - docs/superpowers/specs/2026-06-18-discord-personal-server-channel-design.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Compile writes a local wiki schema artifact

The Hermes Wiki Engine SHALL write a deterministic local schema artifact during successful compile so Hermes and operator tooling can inspect the wiki artifact contract without reading source code.

#### Scenario: Compile writes schema artifact

- **WHEN** `wiki compile` completes successfully
- **THEN** the engine writes `compiled/schema.json`
- **AND** the schema contains `schema_version`, `ref_kinds`, `draft_kinds`, `page_model`, and `governance_rules`

##### Example: minimal schema shape

- **GIVEN** raw cache contains note `note-a`
- **WHEN** `wiki compile` runs successfully
- **THEN** `compiled/schema.json` contains `ref_kinds: ["note", "page"]`
- **AND** `draft_kinds` contains `consolidate`
- **AND** `governance_rules` contains `source_required`

#### Scenario: Schema generation remains local and model-free

- **WHEN** `wiki compile` writes `compiled/schema.json`
- **THEN** the command derives the schema from local constants and artifacts
- **AND** it does not call Joplin Data API, an LLM, an embedding service, a vector database, or an external retrieval API


<!-- @trace
source: close-llm-wiki-architecture-gap
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Consolidation drafts preserve source refs before writeback

The Hermes Wiki Engine SHALL route knowledge consolidation through reviewable filesystem drafts before any durable Joplin writeback.

#### Scenario: Consolidation creates a reviewable draft

- **WHEN** an operator runs `wiki draft consolidate --ref note:note-a --ref page:page-topic "Durable summary"`
- **THEN** the command writes a filesystem draft with `kind: "consolidate"`
- **AND** the draft contains `status: "pending_review"`, the provided content, and provenance refs `note:note-a` and `page:page-topic`
- **AND** the command returns JSON with `ok: true`, `state: "drafted"`, `draft_id`, `kind: "consolidate"`, and draft path

#### Scenario: Consolidation draft does not mutate durable artifacts

- **WHEN** `wiki draft consolidate` completes successfully
- **THEN** it does not write Joplin notes
- **AND** it does not modify raw cache, compiled notes, compiled pages, graph artifacts, status, or audit artifacts

#### Scenario: Consolidation requires content

- **WHEN** an operator runs `wiki draft consolidate --ref note:note-a` without draft content
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains stable code `DRAFT_CONTENT_MISSING`
- **AND** no draft file is written

#### Scenario: Consolidation rejects unsafe refs

- **WHEN** an operator runs `wiki draft consolidate --ref note:../secret "Durable summary"`
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains a stable unsafe-ref code
- **AND** no draft file is written outside the drafts directory


<!-- @trace
source: close-llm-wiki-architecture-gap
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Governance audit covers consolidation artifacts

The Hermes Wiki Engine SHALL extend local audit to detect deterministic governance errors across compiled pages, graph artifacts, and filesystem drafts without semantic grading.

#### Scenario: Audit reports draft missing target

- **GIVEN** a filesystem draft has `kind: "consolidate"`, provenance refs, and content
- **AND** the draft has no target notebook id
- **WHEN** `wiki audit` runs
- **THEN** `audit/error-book.json` contains an entry with kind `draft_target_missing`
- **AND** the command output increments `kind_counts.draft_target_missing`

#### Scenario: Audit reports missing source refs

- **GIVEN** a consolidation draft references `note:missing-note`
- **AND** compiled notes do not contain `missing-note`
- **WHEN** `wiki audit` runs
- **THEN** `audit/error-book.json` contains an entry with kind `missing_source`
- **AND** the entry references the draft id and missing source ref

#### Scenario: Audit remains deterministic and non-mutating toward Joplin

- **WHEN** `wiki audit` evaluates consolidation artifacts
- **THEN** it reads and writes only local filesystem artifacts
- **AND** it does not write Joplin notes
- **AND** it does not call an LLM, embedding service, vector database, or external retrieval API


<!-- @trace
source: close-llm-wiki-architecture-gap
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Hermes skill describes consolidation as review-gated memory sedimentation

The Hermes Wiki Engine SHALL provide Hermes operator guidance that treats consolidation as a review-gated memory sedimentation workflow, not as a foreground answer source.

#### Scenario: Hermes uses query and read path for memory answers

- **WHEN** Hermes answers a memory question
- **THEN** the wiki skill instructs Hermes to use `wiki query`, `wiki read`, or `wiki links` for source-backed evidence
- **AND** it instructs Hermes to report insufficient evidence when local wiki tools do not return sources

#### Scenario: Hermes uses consolidation draft for knowledge organization

- **WHEN** the user asks Hermes to organize or sediment knowledge from existing local memory refs
- **THEN** the wiki skill instructs Hermes to create a `wiki draft consolidate` draft
- **AND** it instructs Hermes that Joplin writeback requires `wiki approve`

#### Scenario: Hermes skill preserves writeback boundary

- **WHEN** Hermes creates a consolidation draft
- **THEN** the wiki skill forbids claiming the knowledge was written to Joplin until `wiki approve` succeeds
- **AND** it forbids printing token files or secret environment contents

<!-- @trace
source: close-llm-wiki-architecture-gap
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->