## MODIFIED Requirements

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

#### Scenario: Multi-term contextual matches outrank single-term generic matches

- **GIVEN** one compiled note contains `Hermes`, `wiki`, `engine`, `Joplin`, and `長期記憶` in the same local context
- **AND** another compiled note contains only `Joplin` as a generic tutorial
- **AND** another compiled note contains only `Hermes` as a keyboard brand
- **WHEN** the operator runs `wiki query "Hermes wiki engine Joplin 長期記憶"`
- **THEN** the contextual Hermes wiki engine note appears before the generic tutorial and keyboard notes
- **AND** the generic single-term notes have lower scores than the contextual match

#### Scenario: Domain-specific brand false positives are downgraded

- **GIVEN** a compiled note has title `Gamdias Hermes keyboard` and body `Hermes Ultimate keyboard`
- **AND** a compiled note has title `Hermes Wiki Engine` and body `Joplin long-term memory for Hermes`
- **WHEN** the operator runs `wiki query "Hermes 長期記憶"`
- **THEN** the Hermes wiki engine note appears before the keyboard article

### Requirement: Query can rerank bounded candidates with local LLM

The Hermes Wiki Engine SHALL provide an explicit `wiki query --rerank-llm` mode that uses a configured local LLM provider to rerank bounded keyword candidates. The reranker MUST preserve source-backed result refs and MUST NOT become an answer source.

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

#### Scenario: Rerank prompt distinguishes Hermes memory system context

- **WHEN** `wiki query "Hermes wiki engine Joplin 長期記憶" --rerank-llm` invokes the local LLM provider
- **THEN** the prompt instructs the provider to prioritize Hermes wiki engine and Hermes long-term memory system candidates
- **AND** the prompt instructs the provider to downgrade generic Joplin tutorials, generic AI assistant articles, and keyboard brand Hermes candidates
- **AND** the prompt still requires output to be only a JSON array of known candidate refs with relevance and reason

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
