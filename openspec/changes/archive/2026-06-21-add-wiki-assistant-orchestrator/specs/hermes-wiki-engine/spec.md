## ADDED Requirements

### Requirement: Assistant route produces deterministic wiki action plans

The Hermes Wiki Engine SHALL expose an assistant route command that converts normalized conversational wiki requests into deterministic action plans or fail-closed messages without relying on model-generated success claims.

#### Scenario: Unsupported assistant input fails safely

- **WHEN** an operator runs `wiki assistant route --input <missing-or-invalid-path>` or provides invalid JSON
- **THEN** the command returns JSON with `ok` set to `false`, `state` set to `failed_closed`, and a safe error code without printing stack traces or secret values

#### Scenario: Non-wiki conversation passes through

- **WHEN** the input event text does not contain a wiki sedimentation or draft-review intent
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `no_action`, and no capture payload

### Requirement: Assistant route keeps reply-context sedimentation proof-gated

The Hermes Wiki Engine SHALL require a resolved full original message before routing reply-context sedimentation into capture input.

#### Scenario: Reply sedimentation without resolved full message fails closed

- **WHEN** the input event contains a sedimentation intent and `reply_to_id` but does not contain `resolved_event.text`
- **THEN** the command returns JSON with `ok` set to `false`, `state` set to `failed_closed`, `code` set to `ASSISTANT_REPLY_TARGET_UNRESOLVED`, and no capture payload

#### Scenario: Reply sedimentation ignores reply preview text

- **WHEN** the input event contains `reply_to_id`, `reply_to_text`, and `resolved_event.text`
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `action_required`, `action` set to `capture_from_resolved_message`, and `capture_input.events[0].text` equal to `resolved_event.text`
- **THEN** `capture_input.events[0].text` MUST NOT equal the user instruction text or `reply_to_text`

##### Example: resolved bot answer is used instead of preview

- **GIVEN** `text` is `這段值得沉澱，整理成待審草稿`
- **GIVEN** `reply_to_text` is `截斷 preview`
- **GIVEN** `resolved_event.text` is `完整的 Hermes bot 回答，包含所有段落。`
- **WHEN** `wiki assistant route --input event.json` is executed
- **THEN** `capture_input.events[0].text` is `完整的 Hermes bot 回答，包含所有段落。`

### Requirement: Assistant route separates command-only and inline capture requests

The Hermes Wiki Engine SHALL refuse command-only sedimentation requests and SHALL only route inline capture when the same user message includes an explicit substantive body.

#### Scenario: Command-only sedimentation asks for a target

- **WHEN** the input event text is `這段值得沉澱` and there is no `reply_to_id`, no `resolved_event`, and no inline body
- **THEN** the command returns JSON with `ok` set to `false`, `state` set to `failed_closed`, `code` set to `ASSISTANT_CAPTURE_TARGET_REQUIRED`, and no capture payload

#### Scenario: Inline body sedimentation creates capture payload

- **WHEN** the input event text is `整理成待審草稿：這是要沉澱的完整正文。`
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `action_required`, `action` set to `capture_inline_body`, and `capture_input.events[0].text` set to `這是要沉澱的完整正文。`

### Requirement: Assistant route sends draft review to the draft show bridge

The Hermes Wiki Engine SHALL route natural-language draft review requests to the deterministic draft show command bridge.

#### Scenario: Draft review request produces draft show command

- **WHEN** the input event text contains `給我看 draft-telegram-abc123 的全文`
- **THEN** the command returns JSON with `ok` set to `true`, `state` set to `action_required`, `action` set to `show_draft`, and a command equivalent to `wiki draft show draft-telegram-abc123 --message-only`

#### Scenario: Unsafe draft id fails closed

- **WHEN** the input event text asks to show a draft id that is not a safe wiki draft identifier
- **THEN** the command returns JSON with `ok` set to `false`, `state` set to `failed_closed`, `code` set to `ASSISTANT_DRAFT_ID_INVALID`, and no filesystem search command
