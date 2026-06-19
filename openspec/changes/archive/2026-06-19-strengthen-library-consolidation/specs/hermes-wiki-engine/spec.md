## ADDED Requirements

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
