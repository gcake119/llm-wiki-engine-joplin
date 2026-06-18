# Hermes Wiki Engine

Hermes Wiki Engine 是給 Hermes 使用的本機知識引擎。第一版命令叫 `wiki`。

## Scope

- 從 Joplin Data API 同步全筆記庫。
- 編譯 wiki / graph / index，供 Hermes 查詢本機長期記憶。
- 從 Telegram / Discord 產生 draft，人工 approve 後才寫回 Joplin。
- 使用 `wiki` 作為 Hermes command bridge。

## Commands

```zsh
wiki status
wiki sync
wiki compile
wiki query "問題"
wiki draft telegram ...
wiki draft discord ...
wiki approve <draft-id>
```

`wiki compile` 代表完整更新知識庫：preflight、Joplin raw sync、compile、graph / index、lint / health snapshot。

`wiki sync` 只做輕量 Joplin raw sync，適合背景定時跑。

`wiki query` 只查已完成 cache / graph / index。它不會在 Hermes 前台對話臨時重編全庫。

## Boundaries

- Joplin 是長期知識庫 SSOT。
- Hermes 讀已完成 cache，不在前台對話臨時重編全庫。
- Telegram / Discord 是 capture source，不直接寫入正式知識庫。
- 跨 macOS 使用者整合只走 Joplin Data API，不讀主使用者 Joplin SQLite。
- Joplin token 放在 `hermes` 使用者 secret env，不進 git、不印 log。

## Planned Runtime

```text
/Users/hermes/projects/hermes-wiki-engine
/Users/hermes/.local/bin/wiki
/Users/hermes/.hermes/skills/wiki/SKILL.md
/Users/hermes/knowledge/
/Users/hermes/.config/hermes-knowledge/env
```

正式乾淨 workspace 預定為：

```text
/Users/caiyijun/project/hermes-wiki-engine
```

目前本目錄只是 planning spike，規劃完成後再搬出去實作。

## First Implementation Slice

第一個 slice 只做：

- `wiki status`
- `wiki sync`
- Joplin Data API preflight
- notes metadata raw cache
- lock file + `status.json`

暫不做 Telegram / Discord API、Joplin writeback、graph compile、附件 OCR。
