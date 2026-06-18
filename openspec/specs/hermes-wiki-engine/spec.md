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