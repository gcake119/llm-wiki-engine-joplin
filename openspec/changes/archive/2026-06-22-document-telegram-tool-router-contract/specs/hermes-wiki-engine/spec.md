## ADDED Requirements

### Requirement: Telegram tool router calls wiki command bridge deterministically

The Hermes Wiki Engine SHALL define `/wiki` and `wiki` Telegram tool routes as deterministic calls to the local `wiki` command bridge. The Telegram adapter MUST NOT ask an LLM to decide whether a wiki-prefixed message succeeded.

#### Scenario: Slash wiki route calls wiki CLI

- **WHEN** a Telegram adapter receives `/wiki status`
- **THEN** it calls the configured local `wiki` command with `status` as arguments
- **AND** it does not invoke Hermes LLM fallback for that message

#### Scenario: Bare wiki route calls wiki CLI

- **WHEN** a Telegram adapter receives `wiki query "Workflow Radar"`
- **THEN** it calls the configured local `wiki` command with `query "Workflow Radar"` as arguments
- **AND** it does not invoke Hermes LLM fallback for that message

#### Scenario: Wiki command failure remains tool output

- **WHEN** the configured local `wiki` command exits non-zero or is unavailable
- **THEN** the Telegram adapter returns the process output or stable process failure
- **AND** it does not ask an LLM to explain or recover from the failure

### Requirement: Telegram adapters forward wiki stdout without re-authoring

The Hermes Wiki Engine SHALL expose adapter-safe command output that Telegram or Hermes chat adapters can forward as the outgoing message without LLM rewriting.

#### Scenario: Message-only sedimentation reply is forwarded unchanged

- **WHEN** a Telegram adapter pipes draft, capture, or approve JSON into `wiki sedimentation reply --message-only`
- **THEN** it sends stdout unchanged as the Telegram reply
- **AND** it does not let an LLM rewrite the result into a stronger success claim

#### Scenario: Normal wiki command stdout is forwarded unchanged

- **WHEN** a Telegram adapter calls `wiki status`, `wiki query`, `wiki read`, `wiki links`, or `wiki draft show --message-only`
- **THEN** it sends stdout unchanged except transport-level message chunking
- **AND** it does not add inferred facts, paths, draft ids, note ids, or Joplin writeback claims

### Requirement: Telegram router ownership stays outside wiki engine runtime

The Hermes Wiki Engine SHALL remain a local CLI engine and SHALL NOT own Telegram polling for a shared bot token.

#### Scenario: External gateway owns polling

- **WHEN** Meeting Agent gateway, Hermes gateway, or another Telegram adapter routes `/wiki` messages
- **THEN** Hermes Wiki Engine only provides the local `wiki` command behavior
- **AND** it does not start a competing Telegram polling process

#### Scenario: General chat is outside wiki route

- **WHEN** a Telegram message does not match `/wiki` or `wiki` route forms
- **THEN** Hermes Wiki Engine does not decide whether to call Hermes chat fallback
- **AND** that fallback decision remains owned by the external Telegram gateway
