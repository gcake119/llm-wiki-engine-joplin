## ADDED Requirements

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

## MODIFIED Requirements

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
