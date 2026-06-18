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
