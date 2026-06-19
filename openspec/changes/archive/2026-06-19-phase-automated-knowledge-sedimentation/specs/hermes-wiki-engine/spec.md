## ADDED Requirements

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
