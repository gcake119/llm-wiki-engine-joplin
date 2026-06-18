# Wiki

Use this skill when the user asks Hermes to query long-term local memory, update the local wiki, sync Joplin notes, or capture Telegram / Discord knowledge drafts.

Use the command bridge by absolute path:

```zsh
/Users/hermes/.local/bin/wiki status
/Users/hermes/.local/bin/wiki sync
/Users/hermes/.local/bin/wiki compile
/Users/hermes/.local/bin/wiki query "問題"
```

Rules:

- For memory questions, call `wiki query`.
- For "更新我的知識庫", call `wiki compile`.
- For lightweight Joplin sync, call `wiki sync`.
- Do not claim knowledge was found unless `wiki query` returns sources.
- If `wiki query` reports no sources, tell the user the local memory has insufficient evidence.
- Treat Joplin as the long-term knowledge source of truth.
- Treat Telegram / Discord as capture sources that must go through draft approval.
- Do not write Telegram / Discord content into Joplin without an approved draft.
- Do not print token files or secret env contents.
