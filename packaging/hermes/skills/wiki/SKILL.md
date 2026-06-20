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
/Users/hermes/.local/bin/wiki capture telegram --input <path>
/Users/hermes/.local/bin/wiki capture discord --input <path>
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
