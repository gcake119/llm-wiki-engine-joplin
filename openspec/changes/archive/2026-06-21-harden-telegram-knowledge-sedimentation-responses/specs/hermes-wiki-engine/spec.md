## ADDED Requirements

### Requirement: Knowledge sedimentation replies are tool-result gated

The Hermes Wiki Engine SHALL define a tool-result-gated reply contract for Hermes and Telegram knowledge sedimentation conversations. User-facing replies MUST distinguish suggested sedimentation, draft creation, and Joplin approval states.

#### Scenario: Suggested sedimentation is not reported as persisted

- **WHEN** Hermes or a Telegram-facing agent decides that content is suitable for long-term knowledge sedimentation before a draft tool has returned success
- **THEN** the reply MUST describe the content as a candidate or suggested draft
- **AND** the reply MUST NOT claim that the content has been stored in the notebook, written to Joplin, or added to the long-term knowledge base

##### Example: suggested reply before tool success

- **GIVEN** no draft tool result has been returned
- **WHEN** the agent prepares a reply for "please store this as long-term knowledge"
- **THEN** the reply says "this can be prepared as a review draft" and does not say "stored in Joplin"

#### Scenario: Draft creation reports draft proof only

- **WHEN** a draft or capture tool returns JSON with `ok` set to `true`, `state` set to `drafted`, and a non-empty `draft_id`
- **THEN** the reply MUST include the `draft_id`
- **AND** the reply MUST state that the draft is pending review and has not been written to Joplin

#### Scenario: Approval reports Joplin proof

- **WHEN** `wiki approve` returns JSON with `ok` set to `true`, `state` set to `approved`, and a non-empty `joplin_note_id`
- **THEN** the reply MUST state that the content has been written to Joplin only as a result of the successful approval
- **AND** the reply MUST include the `joplin_note_id` or equivalent review evidence

#### Scenario: Empty tool response fails closed

- **WHEN** a sedimentation, draft, capture, or approve tool call returns an empty response, unparsable response, or a response missing required proof fields
- **THEN** the reply MUST state that the system cannot confirm draft creation or Joplin writeback
- **AND** the reply MUST NOT reuse a prepared success message
- **AND** the reply MUST NOT expose runtime fallback diagnostics to the user

##### Example: empty response after tool calls

- **GIVEN** the tool result text is empty
- **WHEN** the agent formats the final user reply
- **THEN** the reply says the result cannot be confirmed and does not include runtime fallback diagnostics

### Requirement: Telegram capture replies preserve approve-only writeback

The Hermes Wiki Engine SHALL keep Telegram capture and Telegram-facing sedimentation replies aligned with approve-only Joplin writeback. Telegram-originated content MUST enter the system as reviewable filesystem drafts before it can become Joplin-backed long-term knowledge.

#### Scenario: Telegram capture creates reviewable draft only

- **WHEN** Telegram-originated content is accepted for capture
- **THEN** the system MUST create or describe a reviewable filesystem draft before any Joplin writeback
- **AND** the user-facing reply MUST NOT claim permanent knowledge storage until approval succeeds

##### Example: Telegram capture draft

- **GIVEN** Telegram capture returns `draft_id` equal to `draft-telegram-123`
- **WHEN** the user asks whether the content has been stored
- **THEN** the reply includes `draft-telegram-123` and says the draft is pending review

#### Scenario: Telegram approval remains explicit

- **WHEN** a user asks to permanently store a Telegram-originated draft
- **THEN** the system MUST require an explicit approval operation that returns Joplin writeback proof
- **AND** non-approve capture, draft, audit, automation, semantic, or query operations MUST NOT be described as Joplin writeback

##### Example: approval proof

- **GIVEN** `wiki approve` returns `joplin_note_id` equal to `note-abc`
- **WHEN** the agent reports permanent storage
- **THEN** the reply includes `note-abc` as the Joplin writeback proof
