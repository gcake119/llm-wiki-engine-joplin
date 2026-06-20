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

The Hermes Wiki Engine SHALL rank local query results with deterministic lexical scoring over `compiled/notes.json` when the operator does not explicitly request LLM reranking.

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
source: add-local-llm-query-rerank
updated: 2026-06-20
code:
  - src/wiki.js
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - README.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Hermes uses local wiki tools instead of RAG

The Hermes Wiki Engine SHALL expose local wiki artifacts and commands for Hermes. It MUST NOT introduce a hosted RAG service, vector database, cloud model retrieval step, or model-dependent default query path as part of read path hardening.

#### Scenario: Pnpm global bin prints command output through symlink

- **GIVEN** the `wiki` CLI is executed through a symlinked package-manager bin path
- **WHEN** an operator runs `wiki query` without a question
- **THEN** the CLI prints the same query usage message as direct execution
- **AND** it exits successfully without silently returning empty stdout

#### Scenario: macOS LaunchDaemon helper schedules review-gated automation

- **WHEN** an operator installs the macOS automation LaunchDaemon helper
- **THEN** the helper schedules `wiki automate once` through launchd as the Hermes user
- **AND** it writes logs under the Hermes user home
- **AND** it does not store Joplin tokens or other secrets in the LaunchDaemon plist
- **AND** it does not call `wiki approve`, create direct Joplin writeback, or bypass review-gated artifacts

#### Scenario: LaunchDaemon status can be verified with deterministic commands

- **WHEN** the LaunchDaemon is installed
- **THEN** documentation shows commands to inspect `launchctl print system/com.hermes.wiki-automate`
- **AND** documentation shows commands to inspect `wiki automate status`
- **AND** documentation shows commands to inspect recent automation run artifacts

#### Scenario: Query remains local and deterministic by default

- **WHEN** an operator runs `wiki query "example"` without a rerank flag
- **THEN** the command reads completed local artifacts
- **AND** it does not call an embedding service, vector database, LLM, or external retrieval API

#### Scenario: Explicit rerank uses local LLM only after local candidate retrieval

- **WHEN** an operator runs `wiki query "example" --rerank-llm`
- **THEN** the command reads completed local artifacts to build a bounded candidate set before invoking the local LLM provider
- **AND** it does not call Joplin Data API, a vector database, a cloud model provider, or an external retrieval API

#### Scenario: Compile remains model-free

- **WHEN** an operator runs `wiki compile`
- **THEN** the command derives compiled notes and graph artifacts from local raw cache
- **AND** it does not call an LLM, embedding model, or vector index


<!-- @trace
source: add-local-llm-query-rerank
updated: 2026-06-20
code:
  - src/wiki.js
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - README.md
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

The Hermes Wiki Engine SHALL route knowledge consolidation through reviewable filesystem drafts before any durable Joplin writeback, and consolidation draft content SHALL be generated from resolved local source artifacts instead of merely storing the operator goal text.

#### Scenario: Consolidation creates a source-backed reviewable draft

- **WHEN** an operator runs `wiki draft consolidate --ref note:note-a --ref page:page-topic "Durable summary"`
- **THEN** the command writes a filesystem draft with `kind: "consolidate"`
- **AND** the draft contains `status: "pending_review"`
- **AND** the draft content contains the operator goal `Durable summary`
- **AND** the draft content contains provenance refs `note:note-a` and `page:page-topic`
- **AND** the draft content contains resolved source titles and bounded excerpts or summaries from local compiled artifacts
- **AND** the command returns JSON with `ok: true`, `state: "drafted"`, `draft_id`, `kind: "consolidate"`, and draft path

##### Example: note source becomes extractive draft content

- **GIVEN** `compiled/notes.json` contains note `note-a` with title `Keyboard DIY` and plain text `PBT keycaps resist shine. ABS keycaps become glossy after long use.`
- **WHEN** the operator runs `wiki draft consolidate --ref note:note-a "Keycap material note"`
- **THEN** the draft content contains `Keycap material note`, `note:note-a`, `Keyboard DIY`, and `PBT keycaps resist shine`
- **AND** the draft content is longer than the operator goal alone

#### Scenario: Consolidation draft does not mutate durable artifacts

- **WHEN** `wiki draft consolidate` completes successfully
- **THEN** it does not write Joplin notes
- **AND** it does not modify raw cache, compiled notes, compiled pages, graph artifacts, status, or audit artifacts
- **AND** it does not call Joplin Data API, an LLM, an embedding service, a vector database, or an external retrieval API

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

#### Scenario: Consolidation rejects missing local sources

- **WHEN** an operator runs `wiki draft consolidate --ref note:missing-note "Durable summary"`
- **AND** local compiled artifacts do not contain `note:missing-note`
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains stable code `DRAFT_SOURCE_MISSING`
- **AND** no draft file is written


<!-- @trace
source: generate-source-backed-consolidation-drafts
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
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

---
### Requirement: Full-library consolidation automation is phased

The Hermes Wiki Engine SHALL deliver full-library consolidation automation as a staged pipeline inside this change so explicit source-backed drafts, full-library candidate discovery, candidate-to-draft creation, and review governance can be verified separately.

#### Scenario: Phase 1 creates explicit source-backed drafts

- **WHEN** this change is applied
- **THEN** `wiki draft consolidate` requires explicit source refs supplied by the operator
- **AND** it produces reviewable source-backed drafts from those refs
- **AND** it does not approve or write Joplin notes

#### Scenario: Phase 2 discovers full-library candidates

- **WHEN** an operator runs the full-library candidate discovery flow
- **THEN** the engine reads compiled local artifacts and writes or returns a bounded candidate list
- **AND** each candidate contains source refs, a reason, a priority bucket or score, and a proposed consolidation goal
- **AND** the flow does not approve or write Joplin notes

##### Example: Phase 2 candidate discovery

- **GIVEN** compiled notes contain `note:a` titled `Keyboard DIY part 1` and `note:b` titled `Keyboard DIY part 2`
- **WHEN** the operator runs `wiki draft candidates --limit 1`
- **THEN** the returned candidate list contains one candidate with refs `note:a` and `note:b`
- **AND** that candidate contains reason `related_title`, priority `medium`, and goal `Consolidate Keyboard DIY notes`
- **AND** no draft or Joplin note is written

#### Scenario: Phase 3 records review governance

- **WHEN** a candidate draft is approved or rejected
- **THEN** the engine records local review evidence that links candidate id, draft id, decision, and Joplin note id when approved
- **AND** Joplin writeback remains gated by `wiki approve`


<!-- @trace
source: generate-source-backed-consolidation-drafts
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Full-library candidate discovery uses local artifacts

The Hermes Wiki Engine SHALL discover full-library consolidation candidates from completed local compiled artifacts without calling external services.

#### Scenario: Candidate discovery returns bounded candidates

- **GIVEN** `compiled/notes.json` contains notes from multiple notebooks
- **WHEN** an operator runs the candidate discovery flow
- **THEN** the command returns or writes a bounded candidate list
- **AND** each candidate references existing `note:` or `page:` refs
- **AND** the command does not call Joplin Data API, an LLM, an embedding service, a vector database, or an external retrieval API

##### Example: candidate list shape

- **GIVEN** compiled notes contain `note:a` titled `Keyboard DIY part 1` and `note:b` titled `Keyboard DIY part 2`
- **WHEN** the operator runs `wiki draft candidates --limit 1`
- **THEN** the candidate list contains one candidate with refs `note:a` and `note:b`
- **AND** the candidate contains reason `related_title`, priority `medium`, and goal `Consolidate Keyboard DIY notes`

#### Scenario: Candidate discovery fails without compiled artifacts

- **WHEN** an operator runs candidate discovery before `wiki compile`
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains a stable compiled-artifact missing code
- **AND** no candidate or draft file is written


<!-- @trace
source: generate-source-backed-consolidation-drafts
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Candidate drafts remain review-gated

The Hermes Wiki Engine SHALL convert selected full-library candidates into reviewable consolidation drafts without bypassing manual approval.

#### Scenario: Selected candidate creates review drafts

- **GIVEN** a candidate artifact contains candidate `candidate-a` with refs `note:a` and `note:b`
- **WHEN** an operator creates drafts from `candidate-a`
- **THEN** the engine writes one or more filesystem drafts with `kind: "consolidate"`
- **AND** each draft preserves candidate refs in provenance
- **AND** each draft content contains source-backed excerpts generated from compiled artifacts
- **AND** no Joplin note is written

#### Scenario: Unknown candidate is rejected

- **WHEN** an operator creates drafts from unknown candidate `missing-candidate`
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains a stable candidate missing code
- **AND** no draft file is written

<!-- @trace
source: generate-source-backed-consolidation-drafts
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Candidate discovery uses deterministic multi-signal scoring
The Hermes Wiki Engine SHALL discover full-library consolidation candidates from completed local artifacts using deterministic multi-signal scoring. Candidate discovery MUST NOT call Joplin Data API, an LLM, an embedding service, a vector database, or an external retrieval API.

#### Scenario: Candidate discovery emits explainable scored candidates
- **GIVEN** `compiled/notes.json`, `compiled/pages.json`, and `graph/graph.json` exist
- **WHEN** an operator runs `wiki draft candidates --limit 5`
- **THEN** the command writes `candidates/consolidation-candidates.json`
- **AND** each candidate contains `candidate_id`, `refs`, `reasons`, `score`, `priority`, `goal`, `status`, and `proposed_target`
- **AND** `reasons` contains deterministic signal names instead of a single free-text reason

##### Example: title and notebook signals
- **GIVEN** notes `a` and `b` have titles `Keyboard DIY part 1` and `Keyboard DIY part 2`
- **AND** both notes have `parent_id: "folder-1"`
- **WHEN** the operator runs `wiki draft candidates --limit 1`
- **THEN** the first candidate contains refs `note:a` and `note:b`
- **AND** its `reasons` includes `title_prefix` and `same_parent`
- **AND** its `score` is greater than `0`

#### Scenario: Candidate discovery ordering is stable
- **GIVEN** multiple candidates have different scores
- **WHEN** an operator runs candidate discovery twice over unchanged compiled artifacts
- **THEN** the returned candidates appear in descending `score` order
- **AND** candidates with equal score are ordered by `candidate_id` ascending
- **AND** both runs produce the same candidate ids and order

#### Scenario: Candidate discovery remains bounded
- **GIVEN** compiled artifacts can produce more candidates than the requested limit
- **WHEN** an operator runs `wiki draft candidates --limit 2`
- **THEN** the command returns no more than two candidates
- **AND** the candidate artifact contains no more than two candidates


<!-- @trace
source: strengthen-library-consolidation
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Compile produces grouped source-backed wiki pages
The Hermes Wiki Engine SHALL compile local raw notes into grouped topic or entity pages that can contain multiple source notes. Each fact-bearing page section MUST preserve source note references. Compile MUST remain local and model-free.

#### Scenario: Compile groups related notes into a page
- **GIVEN** raw cache contains notes `a` and `b` with related titles and the same parent notebook
- **WHEN** an operator runs `wiki compile`
- **THEN** the engine writes `compiled/pages.json`
- **AND** at least one page contains both `a` and `b` in its `sources`
- **AND** every fact-bearing section in that page contains one or more source note ids

##### Example: grouped keyboard page
- **GIVEN** note `a` has title `Keyboard DIY part 1` and plain text `Switch notes`
- **AND** note `b` has title `Keyboard DIY part 2` and plain text `Keycap notes`
- **WHEN** compile succeeds
- **THEN** a compiled page has sources `a` and `b`
- **AND** the page summary or sections include bounded text from both source notes

#### Scenario: Page refs remain readable and linkable
- **GIVEN** compile produced a grouped page with id `page-keyboard-diy`
- **WHEN** an operator runs `wiki read page:page-keyboard-diy`
- **THEN** the command returns the page artifact with `evidence_status: "source_backed"`
- **WHEN** an operator runs `wiki links page:page-keyboard-diy`
- **THEN** the command returns one-hop `page_source` edges to its source notes

#### Scenario: Compile does not mutate drafts or Joplin
- **WHEN** `wiki compile` produces grouped page artifacts
- **THEN** it writes only local compiled, graph, schema, and status artifacts
- **AND** it does not write drafts, candidates, review artifacts, audit artifacts, or Joplin notes


<!-- @trace
source: strengthen-library-consolidation
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Consolidation drafts accept explicit target notebooks
The Hermes Wiki Engine SHALL let operators provide a target notebook when creating consolidation drafts. Target handling MUST reduce manual JSON editing without bypassing `wiki approve`.

#### Scenario: Explicit consolidation draft stores target notebook
- **GIVEN** compiled artifacts contain note `note-a`
- **WHEN** an operator runs `wiki draft consolidate --target-notebook folder-1 --ref note:note-a "Keycap material note"`
- **THEN** the filesystem draft contains `intended_target.notebook_id: "folder-1"`
- **AND** the command does not call Joplin Data API
- **AND** the command does not write a Joplin note

#### Scenario: Candidate draft uses provided target notebook
- **GIVEN** a candidate artifact contains candidate `candidate-a`
- **WHEN** an operator runs `wiki draft candidate candidate-a --target-notebook folder-1`
- **THEN** the created consolidation draft contains `intended_target.notebook_id: "folder-1"`
- **AND** local review evidence records a pending decision
- **AND** no Joplin note is written

#### Scenario: Unsafe target notebook is rejected before draft write
- **WHEN** an operator runs `wiki draft consolidate --target-notebook ../secret --ref note:note-a "Summary"`
- **THEN** the command returns JSON with `ok: false`
- **AND** the response contains stable code `DRAFT_TARGET_UNSAFE`
- **AND** no draft file is written outside the drafts directory

#### Scenario: Approve remains the only writeback gate
- **GIVEN** a consolidation draft has content, provenance, conflict behavior, and target notebook `folder-1`
- **WHEN** an operator runs `wiki approve <draft-id>` with a configured Joplin token
- **THEN** the command writes one note through Joplin Data API
- **AND** candidate discovery, draft creation, compile, query, read, links, and audit do not write Joplin notes


<!-- @trace
source: strengthen-library-consolidation
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Audit covers candidate and target governance
The Hermes Wiki Engine SHALL audit deterministic governance errors across candidate artifacts, grouped pages, drafts, and review evidence. Audit MUST remain local and non-mutating toward Joplin.

#### Scenario: Audit reports candidate refs missing from compiled artifacts
- **GIVEN** `candidates/consolidation-candidates.json` contains candidate `candidate-a` with ref `note:missing-note`
- **AND** compiled notes do not contain `missing-note`
- **WHEN** `wiki audit` runs
- **THEN** `audit/error-book.json` contains an entry with kind `missing_source`
- **AND** the entry references `candidate-a` and `note:missing-note`
- **AND** command output increments `kind_counts.missing_source`

#### Scenario: Audit reports candidates with too few refs
- **GIVEN** a candidate artifact contains candidate `candidate-a` with only one source ref
- **WHEN** `wiki audit` runs
- **THEN** `audit/error-book.json` contains an entry with kind `candidate_too_small`
- **AND** command output increments `kind_counts.candidate_too_small`

#### Scenario: Audit reports draft target gaps
- **GIVEN** a consolidation draft has source refs and content
- **AND** the draft has no target notebook id
- **WHEN** `wiki audit` runs
- **THEN** `audit/error-book.json` contains an entry with kind `draft_target_missing`
- **AND** command output increments `kind_counts.draft_target_missing`

#### Scenario: Audit remains local only
- **WHEN** `wiki audit` evaluates candidates, pages, drafts, and reviews
- **THEN** it reads and writes only local filesystem artifacts
- **AND** it does not call Joplin Data API, an LLM, an embedding service, a vector database, or an external retrieval API

<!-- @trace
source: strengthen-library-consolidation
updated: 2026-06-19
code:
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - src/wiki.js
tests:
  - test/wiki.test.js
-->

---
### Requirement: Automation runner executes review-gated maintenance pipeline

The system SHALL provide a local automation runner that executes the existing wiki maintenance pipeline as a review-gated background-safe operation.

#### Scenario: One-shot automation records completed maintenance run

- **WHEN** the operator runs `wiki automate once`
- **THEN** the system SHALL execute sync, compile, draft candidate discovery, and audit in sequence
- **AND** the system SHALL write a run artifact containing each step name, status, timestamps, exit code, warnings, and produced artifact references
- **AND** the system SHALL update an automation latest pointer to the completed run artifact
- **AND** the system SHALL NOT call approve or write to Joplin during the automation run

#### Scenario: Automation records failure evidence without continuing unsafe steps

- **WHEN** one automation step fails
- **THEN** the system SHALL stop after the failed step
- **AND** the system SHALL write the failed step, error code, error message, partial artifact references, and prior completed steps to the run artifact
- **AND** the system SHALL return a non-zero CLI exit code
- **AND** the system SHALL NOT call approve or write to Joplin during failure handling

##### Example: compile failure after successful sync

- **GIVEN** sync completes with artifact `raw-cache/latest.json`
- **AND** compile fails with error code `COMPILE_SOURCE_MISSING`
- **WHEN** the operator runs `wiki automate once`
- **THEN** the run artifact SHALL mark sync as `completed` and compile as `failed`
- **AND** the run artifact SHALL NOT contain draft candidate discovery or audit as started steps

#### Scenario: Automation refuses concurrent execution

- **WHEN** a wiki state lock is already held by another maintenance operation
- **THEN** the automation runner SHALL return a busy status
- **AND** the automation runner SHALL NOT start sync, compile, draft, audit, approve, or Joplin writeback

##### Example: active compile lock blocks automation

- **GIVEN** the wiki state contains an active lock owned by `wiki compile`
- **WHEN** the operator runs `wiki automate once`
- **THEN** the command SHALL return status `WIKI_BUSY`
- **AND** no automation run artifact SHALL mark sync as started


<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: LLM-assisted consolidation creates source-backed review drafts

The system SHALL provide an LLM-assisted consolidation command that creates reviewable source-backed drafts from compiled sources or explicit note refs.

#### Scenario: LLM consolidation draft records model and source provenance

- **GIVEN** compiled source refs exist
- **WHEN** the operator runs LLM-assisted consolidation for those refs
- **THEN** the system SHALL invoke the configured local LLM provider
- **AND** the system SHALL write a reviewable consolidation draft containing a source-backed summary, duplicate or related-note recommendations, open questions, source refs, and evidence status
- **AND** the draft SHALL record LLM provenance including provider, model, prompt version, source refs, and creation timestamp
- **AND** the system SHALL NOT approve the draft or write to Joplin

#### Scenario: LLM consolidation fails closed when evidence or provider is missing

- **WHEN** the requested source refs cannot be resolved or the configured LLM provider is unavailable
- **THEN** the system SHALL return an actionable error status
- **AND** the system SHALL NOT write a partial consolidation draft
- **AND** the system SHALL NOT approve or write to Joplin

##### Example: unavailable local LLM provider

- **GIVEN** source ref `note:joplin-123` resolves from compiled artifacts
- **AND** local `ollama call` is unavailable
- **WHEN** the operator runs LLM-assisted consolidation for `note:joplin-123`
- **THEN** the command SHALL return status `LLM_PROVIDER_MISSING`
- **AND** no draft file SHALL be created for that consolidation request


<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Semantic retrieval builds rebuildable source-ref index

The system SHALL provide a semantic retrieval layer that indexes compiled artifacts and returns source refs for operator review or foreground retrieval.

#### Scenario: Semantic build writes rebuildable index artifact

- **GIVEN** compiled wiki artifacts exist
- **WHEN** the operator runs semantic index build
- **THEN** the system SHALL create or replace a semantic index artifact derived only from compiled artifacts
- **AND** each indexed chunk SHALL include a chunk id, page id, source refs, content hash, embedding model metadata, and generated timestamp
- **AND** the system SHALL NOT read Joplin SQLite or write to Joplin

#### Scenario: Semantic query returns scored source refs without becoming the answer source

- **GIVEN** a semantic index artifact exists
- **WHEN** the operator runs semantic query with a natural language query
- **THEN** the system SHALL return scored source refs and snippets
- **AND** the system SHALL preserve enough refs for the foreground read path to verify the result through compiled pages or `wiki read`
- **AND** the system SHALL NOT treat semantic score, embedding output, or pending drafts as authoritative facts

#### Scenario: Semantic retrieval degrades safely when index is missing or stale

- **WHEN** the semantic index is missing, stale, or the embedding provider is unavailable
- **THEN** the system SHALL return a clear status describing the missing prerequisite
- **AND** existing keyword, read, compile, draft, audit, and approve flows SHALL continue to work without semantic retrieval

##### Example: missing semantic index

- **GIVEN** no semantic index artifact exists
- **WHEN** the operator runs semantic query with `project memory writeback`
- **THEN** the command SHALL return status `SEMANTIC_INDEX_MISSING`
- **AND** existing `wiki query project memory writeback` keyword behavior SHALL remain available


<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Capture ingestion creates allowlisted filesystem drafts

The system SHALL provide Telegram and Discord capture ingestion commands that transform allowlisted normalized events into reviewable filesystem drafts.

#### Scenario: Allowlisted capture event creates redacted review draft

- **GIVEN** a normalized Telegram or Discord event belongs to an allowed source
- **WHEN** the operator runs the matching capture ingestion command with that event batch
- **THEN** the system SHALL redact configured sensitive content before writing draft body content
- **AND** the system SHALL write a filesystem capture draft containing source type, source id, message id, timestamp, author handle hash, dedupe key, redaction warnings, and original source reference metadata
- **AND** the system SHALL NOT create or update a Joplin note

#### Scenario: Capture ingestion rejects disallowed or duplicate events

- **WHEN** a capture event is not allowlisted, exceeds the configured rate limit, or duplicates a known dedupe key
- **THEN** the system SHALL skip draft creation for that event
- **AND** the system SHALL write capture run evidence describing the rejection reason
- **AND** the system SHALL NOT create or update a Joplin note

##### Example: disallowed Telegram chat is skipped

- **GIVEN** a Telegram event batch contains chat id `chat-unknown`
- **AND** `chat-unknown` is absent from the configured capture allowlist
- **WHEN** the operator runs `wiki capture telegram --input telegram-events.json`
- **THEN** no filesystem draft SHALL be created for that event
- **AND** capture run evidence SHALL record rejection reason `CAPTURE_SOURCE_NOT_ALLOWED`


<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Automated sedimentation preserves approve-only writeback

The system SHALL preserve `wiki approve` as the only command that performs formal Joplin writeback across automation, LLM, semantic retrieval, and capture ingestion features.

#### Scenario: Non-approve automation commands never write to Joplin

- **WHEN** any automation, LLM-assisted consolidation, semantic retrieval, or capture ingestion command runs
- **THEN** the command SHALL only create local artifacts, candidate records, recommendations, indexes, or reviewable drafts
- **AND** the command SHALL NOT invoke the Joplin writeback path
- **AND** the command SHALL expose review evidence that can later be approved by an operator through `wiki approve`

#### Scenario: Foreground read path does not trigger hidden background work

- **WHEN** a foreground read or query command runs
- **THEN** the command SHALL NOT implicitly start sync, compile, LLM consolidation, semantic index build, capture ingestion, or approve
- **AND** the command SHALL use existing compiled artifacts, source refs, or explicit user-selected retrieval results

##### Example: query uses existing compiled artifacts only

- **GIVEN** compiled artifacts exist
- **AND** no automation run is active
- **WHEN** the operator runs `wiki query "Hermes memory"`
- **THEN** the query command SHALL read existing compiled artifacts
- **AND** the query command SHALL NOT create automation, LLM, semantic build, capture, or approve artifacts


<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Periodic whole-library consolidation creates reviewable drafts

The system SHALL support periodic whole-library consolidation as an externally scheduled, review-gated automation loop.

#### Scenario: Automation status reports latest run without starting work

- **WHEN** the operator runs `wiki automate status`
- **THEN** the system SHALL read the latest automation pointer and matching run artifact
- **AND** the system SHALL return the latest run id, latest run path, latest run state, and summary reference when available
- **AND** the system SHALL NOT start sync, compile, LLM consolidation, semantic build, capture ingestion, approve, or Joplin writeback

#### Scenario: Missing automation status reports a clear prerequisite

- **WHEN** no automation latest pointer exists
- **THEN** `wiki automate status` SHALL return status `AUTOMATION_STATUS_MISSING`
- **AND** the command SHALL NOT create automation, draft, semantic, capture, review, or Joplin artifacts

#### Scenario: Periodic automation creates bounded top-N review drafts

- **WHEN** the operator runs `wiki automate once --draft-top 2`
- **THEN** the system SHALL execute the maintenance pipeline
- **AND** the system SHALL select at most two pending consolidation candidates from the candidate artifact
- **AND** the system SHALL create at most two LLM-assisted reviewable consolidation drafts with source refs and LLM provenance
- **AND** the system SHALL write a periodic summary artifact containing candidate count, draft count, draft ids, audit error count, warnings, notification result, and next actions
- **AND** the system SHALL NOT approve the drafts or write to Joplin

##### Example: top-N draft cap

- **GIVEN** candidate discovery produces three pending candidates `candidate-a`, `candidate-b`, and `candidate-c`
- **WHEN** the operator runs `wiki automate once --draft-top 2`
- **THEN** the summary artifact SHALL report `candidates_seen` as `3`
- **AND** the summary artifact SHALL report exactly two `draft_ids`
- **AND** no Joplin note SHALL be created

#### Scenario: Periodic automation defaults to review evidence only

- **WHEN** the operator runs `wiki automate once` without `--draft-top`
- **THEN** the system SHALL execute sync, compile, candidate discovery, and audit
- **AND** the system SHALL write automation run evidence
- **AND** the system SHALL create zero LLM-assisted drafts

#### Scenario: Periodic automation records LLM provider failure without losing maintenance evidence

- **WHEN** candidate discovery succeeds but the configured LLM provider is unavailable during `wiki automate once --draft-top 1`
- **THEN** the system SHALL preserve the completed maintenance run artifact
- **AND** the periodic summary SHALL include warning `LLM_PROVIDER_MISSING`
- **AND** the periodic summary SHALL report zero created drafts
- **AND** the system SHALL NOT approve or write to Joplin

#### Scenario: Periodic automation rejects invalid draft limit before running maintenance

- **WHEN** the operator runs `wiki automate once --draft-top -1`
- **THEN** the command SHALL return status `AUTOMATION_DRAFT_TOP_INVALID`
- **AND** the system SHALL NOT start sync, compile, candidate discovery, audit, LLM consolidation, approve, or Joplin writeback

<!-- @trace
source: phase-automated-knowledge-sedimentation
updated: 2026-06-19
code:
  - src/wiki.js
  - packaging/hermes/skills/wiki/SKILL.md
  - docs/design.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Open-source package metadata is complete

The Hermes Wiki Engine SHALL provide package metadata suitable for local pnpm packaging and installation as a CLI package without requiring a private Hermes runtime.

#### Scenario: Package metadata names the public repository

- **WHEN** a maintainer inspects package metadata for open-source readiness
- **THEN** the metadata SHALL include the repository URL `https://github.com/gcake119/llm-wiki-engine-joplin`
- **AND** it SHALL keep the `wiki` CLI bin mapped to the Node entrypoint
- **AND** it SHALL declare Node.js version compatibility

#### Scenario: Local package dry run excludes private state

- **WHEN** a maintainer runs the local package dry-run check
- **THEN** the package file list SHALL exclude local state directories, secret environment files, raw knowledge caches, generated runtime artifacts, and token-bearing files
- **AND** it SHALL include the CLI source, package metadata, README, license, security documentation, contribution guidance, environment example, tests, specs, and Hermes packaging guidance


<!-- @trace
source: open-source-file-structure
updated: 2026-06-20
code:
  - SECURITY.md
  - .npmignore
  - README.md
  - LICENSE
  - packaging/hermes/skills/wiki/SKILL.md
  - package.json
  - CONTRIBUTING.md
  - docs/design.md
  - .env.example
  - docs/open-source-file-structure.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Open-source documentation defines a portable install path

The Hermes Wiki Engine SHALL document a portable open-source installation and setup path that does not require the `/Users/hermes` OS user or Hermes-specific absolute paths.

#### Scenario: New user follows the README quickstart

- **WHEN** a new user reads the README quickstart
- **THEN** the quickstart SHALL instruct the user to install or link the CLI, copy the environment example, configure `WIKI_STATE_DIR`, configure Joplin Data API URL and token, run `wiki status`, and then run `wiki sync` or `wiki compile`
- **AND** the quickstart SHALL keep Hermes runtime setup separate from the primary open-source path

#### Scenario: File structure guide explains ownership boundaries

- **WHEN** a contributor reads the open-source file structure guide
- **THEN** the guide SHALL identify root project docs, CLI source, tests, Spectra specs, decision docs, environment examples, pnpm packaging controls, and Hermes packaging guidance as separate responsibility areas
- **AND** it SHALL explain which areas are public package surface and which areas are repo governance or deployment guidance


<!-- @trace
source: open-source-file-structure
updated: 2026-06-20
code:
  - SECURITY.md
  - .npmignore
  - README.md
  - LICENSE
  - packaging/hermes/skills/wiki/SKILL.md
  - package.json
  - CONTRIBUTING.md
  - docs/design.md
  - .env.example
  - docs/open-source-file-structure.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Open-source safety docs preserve Joplin writeback boundaries

The Hermes Wiki Engine SHALL document its secret-handling and writeback boundaries for open-source users without weakening the existing Joplin SSOT model.

#### Scenario: Security documentation describes token handling

- **WHEN** a user reads the security documentation or environment example
- **THEN** the documentation SHALL require Joplin tokens, Discord webhook URLs, Telegram allowlists, and Discord allowlists to be supplied through local environment configuration or equivalent local secret management
- **AND** it SHALL NOT include real token-looking values
- **AND** it SHALL warn users not to commit local environment files, state directories, raw caches, or generated drafts

#### Scenario: Documentation preserves approve-only writeback

- **WHEN** a user reads README, SECURITY, or Hermes packaging guidance
- **THEN** the documentation SHALL state that Joplin remains the long-term source of truth
- **AND** it SHALL state that Joplin integration uses Joplin Data API rather than direct SQLite or profile access
- **AND** it SHALL state that `wiki approve` is the only formal Joplin writeback gate
- **AND** it SHALL state that sync, compile, query, read, links, audit, candidate discovery, automation, capture, and draft creation SHALL NOT write Joplin notes

<!-- @trace
source: open-source-file-structure
updated: 2026-06-20
code:
  - SECURITY.md
  - .npmignore
  - README.md
  - LICENSE
  - packaging/hermes/skills/wiki/SKILL.md
  - package.json
  - CONTRIBUTING.md
  - docs/design.md
  - .env.example
  - docs/open-source-file-structure.md
tests:
  - test/wiki.test.js
-->

---
### Requirement: Query can rerank bounded candidates with local LLM

The Hermes Wiki Engine SHALL provide an explicit `wiki query --rerank-llm` mode that uses a configured local LLM provider to rerank bounded keyword candidates. The reranker MUST preserve source-backed result refs and MUST NOT become an answer source.

#### Scenario: Rerank parser accepts common Ollama JSON wrappers

- **GIVEN** bounded keyword candidates exist for a query
- **WHEN** the local LLM provider returns a single `{ ref, relevance, reason }` object
- **OR** it returns `{ data: [{ ref, relevance, reason }] }`
- **OR** it returns `{ results: [{ ref, relevance, reason }] }`
- **THEN** `wiki query --rerank-llm` accepts the rows only if every returned ref is a known source ref
- **AND** it still returns source-backed reranked results rather than answer text

#### Scenario: Rerank parser still rejects unknown refs in wrappers

- **WHEN** the local LLM provider returns `{ data: [{ ref: "note:unknown", relevance: 1, reason: "bad" }] }`
- **THEN** the command returns `ok: false` with code `LLM_RERANK_UNAVAILABLE`
- **AND** it does not include raw prompts, model output, stack traces, token values, or full note bodies

#### Scenario: Rerank reason uses Traditional Chinese by default

- **WHEN** `wiki query --rerank-llm` invokes the local LLM provider
- **THEN** the prompt instructs the provider to write `reason` in Traditional Chinese
- **AND** the prompt allows English or original text only for technical terms, product names, note titles, refs, and necessary names
- **AND** the prompt still requires JSON-only output with source refs rather than answer text

#### Scenario: LLM rerank reorders matching candidates by relevance

- **GIVEN** `compiled/notes.json` contains multiple keyword candidates for a query
- **WHEN** an operator runs `wiki query "Hermes 長期記憶" --rerank-llm`
- **THEN** the command first selects a bounded candidate set from local keyword matches
- **AND** it invokes the configured local LLM provider with candidate metadata only
- **AND** it returns source-backed results ordered by rerank relevance
- **AND** each reranked result includes the original source ref, keyword score, rerank score, and rerank reason

##### Example: keyboard article is downgraded

- **GIVEN** candidate `note-keyboard` has title `Gamdias Hermes keyboard` and snippet `Hermes Ultimate keyboard`
- **AND** candidate `note-memory` has title `Hermes Wiki Engine` and snippet `Joplin long-term memory for Hermes`
- **WHEN** the operator runs `wiki query "Hermes 長期記憶" --rerank-llm`
- **THEN** `note-memory` appears before `note-keyboard`
- **AND** both results retain source refs for later `wiki read`

#### Scenario: Rerank prompt is bounded and metadata-only

- **WHEN** `wiki query "example" --rerank-llm` invokes the local LLM provider
- **THEN** the prompt includes only the user query and bounded candidate refs, titles, parent ids, snippets, and keyword scores
- **AND** the prompt does not include Joplin token values, environment variable dumps, full raw note bodies, draft content, or writeback payloads

#### Scenario: Rerank failure fails closed

- **WHEN** the local LLM provider is unavailable, returns empty output, returns invalid JSON, or returns only unknown refs
- **THEN** the command returns `ok: false` with code `LLM_RERANK_UNAVAILABLE`
- **AND** the command output does not include raw prompts, stack traces, token values, or full note bodies
- **AND** the command does not silently claim deterministic results were reranked

##### Example: invalid JSON is rejected

- **GIVEN** keyword candidates exist for query `Hermes memory`
- **AND** the local LLM provider returns `not json`
- **WHEN** the operator runs `wiki query "Hermes memory" --rerank-llm`
- **THEN** the command returns code `LLM_RERANK_UNAVAILABLE`

#### Scenario: Rerank remains foreground read-only

- **WHEN** an operator runs `wiki query "example" --rerank-llm`
- **THEN** the command does not start sync, compile, semantic build, capture ingestion, draft creation, automation, approve, or Joplin writeback
- **AND** it does not create draft, automation, semantic, capture, review, raw, compiled, or Joplin artifacts

<!-- @trace
source: add-local-llm-query-rerank
updated: 2026-06-20
code:
  - src/wiki.js
  - docs/design.md
  - packaging/hermes/skills/wiki/SKILL.md
  - README.md
tests:
  - test/wiki.test.js
-->