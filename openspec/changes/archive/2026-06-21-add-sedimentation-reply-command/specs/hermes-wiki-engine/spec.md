## ADDED Requirements

### Requirement: Sedimentation reply command gates user-facing persistence claims

The Hermes Wiki Engine SHALL expose a read-only `wiki sedimentation reply` command that converts draft, capture, or approve tool results into proof-gated user-facing reply JSON.

#### Scenario: Draft success from stdin reports draft only

- **WHEN** `wiki sedimentation reply` receives `{"ok":true,"state":"drafted","draft_id":"draft-test"}` on stdin
- **THEN** the command output MUST be JSON with `state` equal to `draft_created`
- **AND** the output MUST include `draft_id` equal to `draft-test`
- **AND** the output message MUST state that the draft has not been written to Joplin

##### Example: draft reply guard

- **GIVEN** stdin contains `{"ok":true,"state":"drafted","draft_id":"draft-test"}`
- **WHEN** the command runs
- **THEN** the message includes `draft-test` and does not claim Joplin writeback

#### Scenario: Approval success from stdin reports Joplin proof

- **WHEN** `wiki sedimentation reply` receives `{"ok":true,"state":"approved","joplin_note_id":"note-abc"}` on stdin
- **THEN** the command output MUST be JSON with `state` equal to `approved`
- **AND** the output MUST include `joplin_note_id` equal to `note-abc`
- **AND** the output message MUST state that writeback to Joplin succeeded as an approval result

##### Example: approve reply guard

- **GIVEN** stdin contains `{"ok":true,"state":"approved","joplin_note_id":"note-abc"}`
- **WHEN** the command runs
- **THEN** the message includes `note-abc` as Joplin writeback proof

#### Scenario: Capture success from stdin reports draft only

- **WHEN** `wiki sedimentation reply` receives `{"ok":true,"state":"capture_ingested","accepted":1,"drafts":[{"draft_id":"draft-telegram-test"}]}` on stdin
- **THEN** the command output MUST be JSON with `state` equal to `draft_created`
- **AND** the output MUST include `draft_id` equal to `draft-telegram-test`
- **AND** the output message MUST state that the draft has not been written to Joplin

##### Example: capture reply guard

- **GIVEN** stdin contains a capture result with `state` equal to `capture_ingested`, `accepted` greater than zero, and `drafts[0].draft_id`
- **WHEN** the command runs
- **THEN** the message includes the first accepted draft id and does not claim Joplin writeback

#### Scenario: Suggested reply requires no proof

- **WHEN** an operator runs `wiki sedimentation reply --suggested`
- **THEN** the command output MUST be JSON with `state` equal to `suggested`
- **AND** the output message MUST describe a possible review draft
- **AND** the output message MUST NOT claim draft creation or Joplin writeback

#### Scenario: Empty or invalid input fails closed

- **WHEN** `wiki sedimentation reply` receives empty stdin, invalid JSON, `ok:false`, or a success response missing required proof fields
- **THEN** the command output MUST be JSON with `state` equal to `failed`
- **AND** the output message MUST state that draft creation or Joplin writeback cannot be confirmed
- **AND** the output message MUST NOT contain runtime fallback diagnostics or successful persistence claims

#### Scenario: Capture without accepted draft fails closed

- **WHEN** `wiki sedimentation reply` receives a capture result with `state` equal to `capture_ingested` but no accepted draft id, including `accepted:0`, an empty `drafts` array, or a missing `drafts[0].draft_id`
- **THEN** the command output MUST be JSON with `state` equal to `failed`
- **AND** the output message MUST state that draft creation or Joplin writeback cannot be confirmed
- **AND** the output message MUST NOT claim that a draft was created

##### Example: empty reply guard

- **GIVEN** stdin is empty
- **WHEN** the command runs
- **THEN** the message says the result cannot be confirmed and does not say `stored in Joplin`

#### Scenario: Reply command remains read-only

- **WHEN** `wiki sedimentation reply` runs for any input
- **THEN** it MUST NOT call Joplin Data API
- **AND** it MUST NOT create, update, or delete raw, compiled, draft, review, capture, automation, or audit artifacts
- **AND** it MUST NOT require `WIKI_STATE_DIR` or `WIKI_JOPLIN_TOKEN`

#### Scenario: Message-only mode returns the guarded user-facing reply

- **WHEN** `wiki sedimentation reply --message-only` receives a draft, capture, approve, empty, invalid, or missing-proof tool result on stdin
- **THEN** stdout MUST be exactly the proof-gated `message` for the same input
- **AND** stdout MUST NOT include JSON wrapper fields such as `state`, `draft_id`, or `joplin_note_id`
- **AND** failed or missing-proof inputs MUST still produce the fail-closed message
- **AND** Telegram / Hermes chat adapters using this mode MUST send stdout directly and MUST NOT ask a model to rewrite it into a stronger persistence claim

##### Example: message-only draft handoff

- **GIVEN** stdin contains `{"ok":true,"state":"drafted","draft_id":"draft-test"}`
- **WHEN** `wiki sedimentation reply --message-only` runs
- **THEN** stdout is the draft-created message and says the draft has not been written to Joplin

#### Scenario: Natural-language sedimentation request does not require tool routing details

- **WHEN** a Telegram or Hermes user says a natural-language request such as `這段值得沉澱`, `整理成待審草稿`, or `等我確認後再寫入 Joplin`
- **THEN** the chat adapter MUST infer review-gated draft intent
- **AND** the adapter MUST NOT require the user to mention command names, JSON pipe syntax, absolute paths, or proof-gate details
- **AND** the adapter MUST route through `wiki draft` or `wiki capture` before any success-style sedimentation reply
- **AND** the adapter MUST NOT write `/Users/hermes/Drafts`, create Skills, create Memory entries, or claim direct Joplin writeback for that natural-language request

#### Scenario: Reply-context sedimentation captures the replied message

- **WHEN** a Telegram user replies to an existing message with a natural-language sedimentation request such as `這段值得沉澱`
- **THEN** the chat adapter MUST resolve `reply_to_id` through the Hermes session/message store or Telegram message cache
- **AND** the adapter MUST use the full stored original message as the capture content
- **AND** the user's sedimentation request message MUST be treated as routing intent only
- **AND** `reply_to_text` MUST be treated as display preview only, not as the authoritative full-content source
- **AND** the adapter MUST NOT create a draft whose content is only the sedimentation instruction

#### Scenario: Reply-context capture stays disabled until full-message resolver is verified

- **WHEN** the gateway does not have a verified `reply_to_id` to full stored original message resolver
- **THEN** the chat adapter MUST keep reply-context sedimentation fail-closed
- **AND** the adapter MUST NOT pass `reply_to_text` preview into `wiki capture`
- **AND** re-enabling reply-context capture MUST require a runtime test proving the stored draft content equals the full original message

#### Scenario: Message store records full inbound messages for later reply resolution

- **WHEN** `wiki message store telegram --input <path>` receives normalized Telegram events with `source_id`, `message_id`, `author_handle`, `timestamp`, and full `text`
- **THEN** the command output MUST be JSON with `state` equal to `messages_stored`
- **AND** the command MUST write local message-store artifacts keyed by `source_id` and `message_id`
- **AND** the command MUST NOT create review drafts or write to Joplin

##### Example: store inbound message

- **GIVEN** an inbound event contains `source_id` equal to `chat-allowed`, `message_id` equal to `msg-full-1`, and multi-line `text`
- **WHEN** `wiki message store telegram --input <path>` runs
- **THEN** the message can later be resolved by the same source id and message id

#### Scenario: Message store records outbound bot responses for later reply resolution

- **WHEN** a Telegram gateway sends an outbound bot response and receives the sent Telegram `message_id`
- **THEN** the gateway MUST store the full outbound bot response text through `wiki message store telegram --input <path>`
- **AND** the stored event MUST use the chat id as `source_id`
- **AND** the stored event MUST use the sent bot response id as `message_id`
- **AND** a user replying to that bot response MUST be resolvable through `wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>`

##### Example: store bot response

- **GIVEN** Hermes sends a bot response with `message_id` equal to `bot-response-1`
- **WHEN** the user replies to that bot response with `這段值得沉澱`
- **THEN** resolving `reply_to_id` equal to `bot-response-1` returns the full bot response text as capture content

#### Scenario: Message resolve returns a capture-compatible full event

- **WHEN** `wiki message resolve telegram --source-id chat-allowed --message-id msg-full-1` finds a stored message with non-empty text
- **THEN** the command output MUST be JSON with `state` equal to `message_resolved`
- **AND** the output MUST include an `event` with `source_id`, `message_id`, `author_handle`, `timestamp`, and the full original `text`
- **AND** the returned `event` MUST be suitable to wrap as `{"events":[event]}` for `wiki capture telegram --input <path>`
- **AND** downstream capture MUST produce draft content equal to that full original text after normal capture redaction

#### Scenario: Message resolve fails closed without a full target

- **WHEN** `wiki message resolve telegram --source-id <id> --message-id <reply_to_id>` cannot find the stored message
- **THEN** the command output MUST be JSON with `ok` equal to `false`
- **AND** the output code MUST be `MESSAGE_NOT_FOUND`
- **AND** the chat adapter MUST NOT fall back to `reply_to_text`

#### Scenario: Message resolve rejects empty stored text

- **WHEN** `wiki message resolve telegram --source-id <id> --message-id <reply_to_id>` finds a stored message with empty text
- **THEN** the command output MUST be JSON with `ok` equal to `false`
- **AND** the output code MUST be `MESSAGE_TEXT_EMPTY`
- **AND** the chat adapter MUST NOT call `wiki capture` for that reply-context request

#### Scenario: Message store rejects oversized resolver cache entries

- **WHEN** `wiki message store telegram --input <path>` receives an event whose text is larger than `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES`
- **THEN** the command output MUST keep `ok` equal to `true` for the batch
- **AND** the oversized event MUST be rejected with reason `MESSAGE_TEXT_TOO_LARGE`
- **AND** the command MUST NOT store truncated text for that message
- **AND** later `wiki message resolve` for that message MUST fail closed

#### Scenario: Message prune removes expired resolver cache entries

- **WHEN** `wiki message prune telegram` runs with `WIKI_MESSAGE_STORE_TTL_DAYS` configured
- **THEN** the command output MUST be JSON with `state` equal to `message_store_pruned`
- **AND** the command MUST remove resolver cache entries older than the TTL window
- **AND** the command MUST NOT remove review drafts, capture run evidence, review evidence, compiled wiki artifacts, or Joplin notes

#### Scenario: Message resolve fails closed for expired cache entries

- **WHEN** `wiki message resolve telegram --source-id <id> --message-id <reply_to_id>` finds a stored message outside the `WIKI_MESSAGE_STORE_TTL_DAYS` retention window
- **THEN** the command output MUST be JSON with `ok` equal to `false`
- **AND** the output code MUST be `MESSAGE_EXPIRED`
- **AND** the chat adapter MUST NOT call `wiki capture` for that reply-context request

#### Scenario: Truncated reply context fails closed

- **WHEN** a Telegram or Hermes runtime can only provide preview text, a log-truncated snippet, a UI summary, or obviously cut-off `reply_to_text` for a natural-language sedimentation request
- **THEN** the chat adapter MUST NOT call `wiki capture` with that partial content
- **AND** the adapter MUST ask the user to reply to the complete message, paste the complete body, or provide a readable `draft_id`
- **AND** the adapter MUST NOT claim that a review-gated draft was created

#### Scenario: Command-only sedimentation asks for a target

- **WHEN** a Telegram or Hermes user sends a command-only sedimentation request without `reply_to_text`, inline substantive body text, or a `draft_id`
- **THEN** the chat adapter MUST ask the user to reply to the target message, paste the content, or provide a `draft_id`
- **AND** the adapter MUST NOT call `wiki capture` to create a draft from the instruction text alone
- **AND** the adapter MUST NOT claim that a review-gated draft was created

#### Scenario: Telegram capture allowlist is exported to child commands

- **WHEN** a Telegram or Hermes runtime launches `wiki capture telegram` as a child process
- **THEN** the runtime environment MUST expose allowlisted Telegram source ids through `WIKI_CAPTURE_TELEGRAM_ALLOWLIST`
- **AND** sourced env files used by that runtime MUST use `export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=<source-id-list>` when the runtime relies on a sourced env file for allowlist configuration
- **AND** a capture rejected with `CAPTURE_SOURCE_NOT_ALLOWED` MUST NOT be converted into a draft-created sedimentation reply

#### Scenario: Draft show returns reviewable draft content

- **WHEN** an operator runs `wiki draft show <draft-id>` for an existing review-gated draft
- **THEN** the command output MUST be JSON with `state` equal to `draft_loaded`
- **AND** the output MUST include the requested `draft_id`
- **AND** the output MUST include the draft `content`, `status`, `provenance`, and `intended_target`
- **AND** the command MUST NOT read compiled note artifacts or Joplin state to satisfy the request

#### Scenario: Draft show message-only returns content for chat review

- **WHEN** an operator runs `wiki draft show <draft-id> --message-only` for an existing review-gated draft
- **THEN** stdout MUST be exactly the draft `content`
- **AND** stdout MUST NOT include JSON wrapper fields such as `state`, `draft_id`, or `provenance`
- **AND** Telegram / Hermes chat adapters using this mode MUST send stdout directly to the user for review

#### Scenario: Draft show fails closed for unknown draft id

- **WHEN** `wiki draft show <draft-id>` receives an unknown or unsafe draft id
- **THEN** the command output MUST be JSON with `ok` equal to `false`
- **AND** the output code MUST be `DRAFT_NOT_FOUND`
- **AND** Telegram / Hermes chat adapters MUST NOT search arbitrary `/Users/hermes` paths or ask for a filesystem location when a `draft_id` was provided
