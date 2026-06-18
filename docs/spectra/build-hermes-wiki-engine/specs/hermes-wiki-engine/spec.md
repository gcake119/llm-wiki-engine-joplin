## ADDED Requirements

### Requirement: Wiki command bridge exposes stable commands

The Hermes Wiki Engine SHALL expose a local `wiki` command bridge with stable command names for status, sync, compile, query, draft, and approve operations.

#### Scenario: Help lists supported commands

- **WHEN** an operator runs `wiki` with no supported command
- **THEN** the command output lists `status`, `sync`, `compile`, `query`, `draft`, and `approve`

#### Scenario: Unsupported command returns help

- **WHEN** an operator runs `wiki unknown-command`
- **THEN** the command output shows usage help instead of starting a job

### Requirement: Status reports current knowledge engine state

The Hermes Wiki Engine SHALL report its current state as JSON without requiring Joplin, Telegram, Discord, or model services to be available.

#### Scenario: Fresh workspace has no status file

- **WHEN** an operator runs `wiki status` before any sync or compile job has completed
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `new`, and a user-safe message that tells the operator to run sync or compile

#### Scenario: Existing status file is returned

- **WHEN** `status.json` exists in the configured state directory
- **THEN** `wiki status` returns the persisted status JSON

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

### Requirement: Jobs use a single lock and observable status

The Hermes Wiki Engine SHALL prevent concurrent sync or compile jobs with a single lock file and SHALL publish job results through `status.json`.

#### Scenario: Sync refuses to start when busy

- **WHEN** an operator runs `wiki sync` while a lock file indicates another job is running
- **THEN** the command returns JSON with `ok` set to `false`, `code` set to `WIKI_BUSY`, and no new sync job starts

#### Scenario: Successful sync updates status

- **WHEN** `wiki sync` completes successfully
- **THEN** `status.json` records `ok`, `state`, `last_job`, `started_at`, `finished_at`, `notes_seen`, and `warnings`

### Requirement: Foreground query reads completed local memory

The Hermes Wiki Engine SHALL answer memory queries from completed local cache, graph, or index data. It SHALL NOT trigger full-library compile during a foreground Hermes query.

#### Scenario: Query command requires a question

- **WHEN** an operator runs `wiki query` without a question
- **THEN** the command returns a user-facing message asking for a question

#### Scenario: Query without implementation remains explicit

- **WHEN** `wiki query "example"` is run before the retrieval slice is implemented
- **THEN** the command returns stable JSON indicating that the query contract exists but retrieval is not implemented yet

### Requirement: Capture sources write drafts before Joplin writeback

The Hermes Wiki Engine SHALL treat Telegram and Discord as capture sources. It MUST write capture output to filesystem drafts before any Joplin writeback.

#### Scenario: Draft command remains explicit before capture implementation

- **WHEN** an operator runs `wiki draft telegram` or `wiki draft discord` before capture implementation exists
- **THEN** the command returns stable JSON indicating that the draft contract exists but capture is not implemented yet

#### Scenario: Approve command remains explicit before writeback implementation

- **WHEN** an operator runs `wiki approve example-draft` before approve implementation exists
- **THEN** the command returns stable JSON indicating that approve writeback is not implemented yet
