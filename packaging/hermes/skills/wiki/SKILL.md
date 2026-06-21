# Wiki

Use this skill when the user asks Hermes to query long-term local memory, update the local wiki, sync Joplin notes, or capture Telegram / Discord knowledge drafts.

Public repository: https://github.com/gcake119/llm-wiki-engine-joplin

This is the Hermes runtime profile. General open-source users can install the `wiki` CLI without creating `/Users/hermes`; Hermes deployments use the absolute command bridge below.

Use the command bridge by absolute path:

```zsh
/Users/hermes/.local/bin/wiki status
/Users/hermes/.local/bin/wiki sync
/Users/hermes/.local/bin/wiki compile
/Users/hermes/.local/bin/wiki query "問題"
/Users/hermes/.local/bin/wiki query "問題" --rerank-llm
/Users/hermes/.local/bin/wiki read <ref>
/Users/hermes/.local/bin/wiki links <ref>
/Users/hermes/.local/bin/wiki automate once --draft-top <N> --notify
/Users/hermes/.local/bin/wiki automate status
/Users/hermes/.local/bin/wiki draft consolidate --target-notebook <notebook-id> --ref note:<id> "整理內容"
/Users/hermes/.local/bin/wiki draft llm-consolidate --target-notebook <notebook-id> --ref note:<id> "整理內容"
/Users/hermes/.local/bin/wiki draft candidates --limit 10
/Users/hermes/.local/bin/wiki draft candidate <candidate-id> --target-notebook <notebook-id>
/Users/hermes/.local/bin/wiki audit
/Users/hermes/.local/bin/wiki draft reject <draft-id>
/Users/hermes/.local/bin/wiki semantic build
/Users/hermes/.local/bin/wiki semantic query "問題"
/Users/hermes/.local/bin/wiki assistant route --input <path>
/Users/hermes/.local/bin/wiki capture telegram --input <path>
/Users/hermes/.local/bin/wiki capture discord --input <path>
/Users/hermes/.local/bin/wiki message store telegram --input <path>
/Users/hermes/.local/bin/wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>
/Users/hermes/.local/bin/wiki message prune telegram
/Users/hermes/.local/bin/wiki sedimentation reply
/Users/hermes/.local/bin/wiki sedimentation reply --suggested
/Users/hermes/.local/bin/wiki sedimentation reply --message-only
/Users/hermes/.local/bin/wiki draft show <draft-id>
/Users/hermes/.local/bin/wiki draft show <draft-id> --message-only
/Users/hermes/.local/bin/wiki approve <draft-id>
```

Rules:

- For memory questions, call `wiki query`, then use `wiki read` or `wiki links` when a source-backed ref needs more evidence.
- Use `wiki query "問題" --rerank-llm` only when the operator needs local LLM semantic reranking of ambiguous keyword matches.
- Treat rerank scores and rerank reasons as ranking metadata, not facts. Verify useful refs with `wiki read` before answering.
- For "更新我的知識庫", call `wiki compile`.
- For lightweight Joplin sync, call `wiki sync`.
- Do not claim knowledge was found unless `wiki query` returns sources.
- If `wiki query` reports no sources, tell the user the local memory has insufficient evidence.
- For explicit ref consolidation, create a reviewable `wiki draft consolidate --target-notebook ... --ref ...` draft when the target notebook is known. The draft content must come from local compiled source refs, not from unsupported memory.
- For LLM-assisted consolidation, use `wiki draft llm-consolidate --target-notebook ... --ref ...` only with explicit compiled source refs. Treat its LLM output as a reviewable draft, not as an answer source.
- For full-library organizing, run `wiki draft candidates` first. Use the bounded candidate list to inspect refs, reasons, scores, priorities, proposed targets, and goals.
- For periodic whole-library organizing, Hermes, launchd, cron, or another external scheduler may call `wiki automate once --draft-top N --notify`. This runs sync, compile, candidate discovery, audit, optional bounded LLM draft creation, and a safe operator summary.
- Use `wiki automate status` to read the latest automation run and summary. Do not treat status as a trigger for background work.
- Keep `--draft-top` small enough for operator review. Omit it or set `--draft-top 0` when the run should only refresh evidence and candidates.
- To turn a selected candidate into a review draft, run `wiki draft candidate <candidate-id> --target-notebook <notebook-id>` when the target notebook is known. This creates a `kind: "consolidate"` filesystem draft and records pending review evidence.
- Use `wiki semantic query` only as a source-ref discovery aid. Verify useful refs with `wiki read` before answering.
- Do not run `wiki semantic build` implicitly during foreground memory answers; only run it when the operator asks to rebuild semantic retrieval.
- After creating consolidation drafts, run `wiki audit` to surface missing sources, candidate shape problems, target gaps, and local review counts before asking the operator to approve.
- Use `wiki draft reject <draft-id>` when a candidate draft should not be written back.
- Do not treat consolidation drafts as answer sources for foreground memory questions.
- Do not treat LLM-assisted drafts as answer sources, and do not use them to bypass `wiki approve`.
- Treat Joplin as the long-term knowledge source of truth.
- Treat Telegram / Discord as capture sources that must go through draft approval.
- For Telegram / Discord capture, this repo only ingests normalized JSON events into filesystem drafts. The actual bot adapter may run in Hermes or another external process.
- Capture ingestion requires allowlisted sources and writes local run evidence. Disallowed, duplicate, or rate-limited events must not create drafts.
- For natural-language wiki operations, route the normalized conversation event through `/Users/hermes/.local/bin/wiki assistant route --input <path>` before choosing capture, draft review, or ordinary chat. Treat `assistant route` as the engine-owned conversation state machine: it returns `no_action`, `action_required`, or `failed_closed`.
- If `assistant route` returns `action_required` with `capture_from_resolved_message`, execute the returned capture payload through `wiki capture telegram --input <path>`, then pipe the capture JSON into `wiki sedimentation reply --message-only`. The draft body must come from `resolved_event.text`, not from `reply_to_text` or the user's instruction.
- If `assistant route` returns `action_required` with `capture_inline_body`, execute the returned capture payload through `wiki capture telegram --input <path>`, then pipe the capture JSON into `wiki sedimentation reply --message-only`.
- If `assistant route` returns `action_required` with `show_draft`, execute the returned `wiki draft show <draft-id> --message-only` command and send stdout directly.
- If `assistant route` returns `ASSISTANT_REPLY_TARGET_UNRESOLVED` or `ASSISTANT_CAPTURE_TARGET_REQUIRED`, send its message directly and do not ask the model to rewrite it.
- For sedimentation replies, use tool-result proof states:
  - Users may ask naturally, for example "這段值得沉澱", "整理成待審草稿", or "等我確認後再寫入 Joplin". Do not require users to say command names, JSON pipe syntax, absolute paths, or proof-gate details.
  - If the user sends the sedimentation request as a reply to a Telegram message, resolve `reply_to_id` through the Hermes session/message store or Telegram message cache, then use the full stored original message as the content to capture. Treat the user's message as routing intent, not as the draft content.
  - The preferred deterministic bridge is: store every inbound Telegram user message with `wiki message store telegram --input <path>`; also store every outbound bot response after Telegram returns its sent `message_id`, using the same command and the full response text. This is required when the user replies to a bot response because that response is worth turning into a draft.
  - For reply-context sedimentation, resolve the full target with `wiki message resolve telegram --source-id <chat-id> --message-id <reply_to_id>`; only pass the returned full event to `wiki capture telegram` when the resolve result is `ok: true` and `state: "message_resolved"`.
  - If `wiki message resolve` returns `MESSAGE_NOT_FOUND`, `MESSAGE_TEXT_EMPTY`, missing arguments, or any other failure, keep the flow fail-closed and do not fall back to `reply_to_text`.
  - Treat message store as a bounded resolver cache, not long-term memory. Default retention is `WIKI_MESSAGE_STORE_TTL_DAYS=14`; default single-entry limit is `WIKI_MESSAGE_STORE_MAX_TEXT_BYTES=131072`. Oversized entries must be rejected with `MESSAGE_TEXT_TOO_LARGE`, not truncated into incomplete future drafts. Expired entries resolve as `MESSAGE_EXPIRED` and must stay fail-closed.
  - Gateway startup or daily maintenance may call `/Users/hermes/.local/bin/wiki message prune telegram`. Pruning only removes resolver cache entries, not `drafts/`, `review/`, `capture/runs/`, compiled wiki artifacts, or Joplin notes.
  - Treat `reply_to_text` as display preview only, not as the authoritative full-content source. Do not create a draft from preview text, log-truncated snippets, UI summaries, or obviously cut-off `reply_to_text`. If the runtime cannot access the complete replied message, ask the user to reply to the complete message, paste the complete body, or provide a readable `draft_id`.
  - Keep reply-context capture fail-closed until the gateway has a verified `reply_to_id -> full stored original message` resolver. Do not pass `reply_to_text` preview into `wiki capture`; only re-enable capture after a runtime test proves the draft content equals the full original message.
  - If there is no replied message, use inline content only when the same message includes substantive body text after a colon, newline, or equivalent delimiter.
  - If the message is command-only, such as "這份草稿值得沉澱，幫我整理成待審草稿", do not create a draft from that instruction. Ask the user to reply to the target message, paste the content, or provide a `draft_id`.
  - For those natural-language requests, infer the review-gated draft intent and route through `wiki draft` or `wiki capture`, not `/Users/hermes/Drafts`, Skill creation, Memory creation, or direct Joplin writeback.
  - Before sending a success-style Telegram / Hermes reply about saved knowledge, pipe the latest draft, capture, or approve JSON into `/Users/hermes/.local/bin/wiki sedimentation reply` and use the returned `message`.
  - If the chat adapter cannot parse JSON, pipe the same tool result into `/Users/hermes/.local/bin/wiki sedimentation reply --message-only` and send stdout directly without rewriting it.
  - When wiring the Telegram bot / Hermes dialogue layer, use this fixed handoff: `<draft/capture/approve JSON> | /Users/hermes/.local/bin/wiki sedimentation reply --message-only`, then return stdout directly to Telegram. Do not let the model rewrite it into "已成功存入長期筆記庫".
  - For a suggested sedimentation with no tool result yet, call `/Users/hermes/.local/bin/wiki sedimentation reply --suggested`.
  - For a suggested sedimentation that needs direct outgoing text, call `/Users/hermes/.local/bin/wiki sedimentation reply --suggested --message-only`.
  - `draft-only success`: if a draft or capture command returns `ok: true`, `state: "drafted"`, and a non-empty `draft_id`, say the draft was created, include the `draft_id`, and say it has not been written to Joplin.
  - `capture success`: if `wiki capture telegram` or `wiki capture discord` returns `ok: true`, `state: "capture_ingested"`, `accepted` greater than zero, and `drafts[0].draft_id`, say that draft was created, include the `draft_id`, and say it has not been written to Joplin.
  - `approve success`: if `wiki approve` returns `ok: true`, `state: "approved"`, and a non-empty `joplin_note_id`, say it was written to Joplin and include the `joplin_note_id`.
  - `empty tool failure`: if a tool returns an empty response, invalid JSON, `ok: false`, or missing proof fields, say the result cannot be confirmed and do not reuse a prepared success message.
- For draft review requests, users may ask naturally, for example "給我看 draft-... 的全文" or "審閱這份待審草稿". Route these to `/Users/hermes/.local/bin/wiki draft show <draft-id> --message-only` and send stdout directly. Do not search arbitrary `/Users/hermes` paths or ask the user for filesystem locations when a `draft_id` is present.
- Telegram capture allowlists must be exported to child processes, for example `export WIKI_CAPTURE_TELEGRAM_ALLOWLIST=538788141`; assigning the variable without `export` can make `wiki capture telegram` reject the source as `CAPTURE_SOURCE_NOT_ALLOWED`.
- Do not claim a consolidation, Telegram, or Discord draft was written to Joplin until `wiki approve` succeeds.
- Do not write capture or consolidation content into Joplin without an approved draft.
- `wiki approve` is the writeback gate. Candidate discovery, audit, and candidate-to-draft flows must not write Joplin notes.
- `wiki automate once --draft-top N --notify` must not approve, must not write Joplin notes, and must not choose a permanent target notebook automatically.
- This repo does not run a daemon or scheduler by itself. Scheduling belongs to Hermes, launchd, cron, or another external runner.
- Review governance is local evidence only: pending, approved, rejected, and rollback hints live under local review artifacts.
- Keep foreground answers source-backed through `wiki query`, `wiki read`, and `wiki links`.
- Do not use `--rerank-llm` as a default path; ordinary memory answers should stay deterministic unless semantic reranking is explicitly useful.
- Semantic scores are not facts. They point to refs that must be checked against compiled pages or `wiki read`.
- Do not print token files or secret env contents.
