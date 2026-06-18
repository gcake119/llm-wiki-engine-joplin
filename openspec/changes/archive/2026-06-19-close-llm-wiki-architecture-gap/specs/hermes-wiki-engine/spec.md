## ADDED Requirements

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
