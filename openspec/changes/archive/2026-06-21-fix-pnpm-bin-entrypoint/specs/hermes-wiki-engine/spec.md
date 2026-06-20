## MODIFIED Requirements

### Requirement: Hermes uses local wiki tools instead of RAG

The Hermes Wiki Engine SHALL expose local wiki artifacts and commands for Hermes. It MUST NOT introduce a hosted RAG service, vector database, cloud model retrieval step, or model-dependent default query path as part of read path hardening.

#### Scenario: Pnpm global bin prints command output through symlink

- **GIVEN** the `wiki` CLI is executed through a symlinked package-manager bin path
- **WHEN** an operator runs `wiki query` without a question
- **THEN** the CLI prints the same query usage message as direct execution
- **AND** it exits successfully without silently returning empty stdout

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
