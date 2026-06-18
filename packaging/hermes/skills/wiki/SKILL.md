# Wiki

Use this skill when the user asks Hermes to query long-term local memory, update the local wiki, sync Joplin notes, or capture Telegram / Discord knowledge drafts.

Use the command bridge by absolute path:

```zsh
/Users/hermes/.local/bin/wiki status
/Users/hermes/.local/bin/wiki sync
/Users/hermes/.local/bin/wiki compile
/Users/hermes/.local/bin/wiki query "問題"
/Users/hermes/.local/bin/wiki read <ref>
/Users/hermes/.local/bin/wiki links <ref>
/Users/hermes/.local/bin/wiki draft consolidate --ref note:<id> "整理內容"
/Users/hermes/.local/bin/wiki approve <draft-id>
```

Rules:

- For memory questions, call `wiki query`, then use `wiki read` or `wiki links` when a source-backed ref needs more evidence.
- For "更新我的知識庫", call `wiki compile`.
- For lightweight Joplin sync, call `wiki sync`.
- Do not claim knowledge was found unless `wiki query` returns sources.
- If `wiki query` reports no sources, tell the user the local memory has insufficient evidence.
- For organizing or sedimenting knowledge from existing local refs, create a reviewable `wiki draft consolidate` draft.
- Do not treat consolidation drafts as answer sources for foreground memory questions.
- Treat Joplin as the long-term knowledge source of truth.
- Treat Telegram / Discord as capture sources that must go through draft approval.
- Do not claim a consolidation, Telegram, or Discord draft was written to Joplin until `wiki approve` succeeds.
- Do not write capture or consolidation content into Joplin without an approved draft.
- Do not print token files or secret env contents.
