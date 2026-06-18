# Hermes Wiki Engine Design

## Product Position

Hermes Wiki Engine 是 Hermes 的本機長期記憶引擎。它基於 `joplin-llm-wiki` 已驗證的 workflow 經驗重新設計，但第一版服務於 Hermes 背景執行與 retrieval memory。

成熟領域上，它屬於 agent memory ingestion pipeline、personal knowledge management backend、local-first retrieval layer。設計採用常見分層：source of truth、ingestion cache、processing pipeline、review gate、retrieval API。不要把它做成新的通用 agent framework。

## Source Of Truth

- Joplin 是人類可編輯的長期知識庫 SSOT。
- Joplin Data API 是跨 macOS 使用者的整合邊界。
- local cache、compiled wiki、graph、index 都是可重建產物。
- Telegram / Discord 是 capture source，不是長期知識庫。
- Hermes 是對話入口與記憶使用者，不直接修改正式知識庫。

## Architecture

```text
Joplin Desktop
  -> Joplin Data API
  -> wiki sync / compile
  -> local cache / compiled pages / graph / schema
  -> wiki query / read / links
  -> Hermes

Telegram / Discord
  -> wiki draft
  -> /Users/hermes/knowledge/drafts/
  -> wiki approve
  -> Joplin Data API

Existing local memory refs
  -> wiki draft consolidate
  -> /Users/hermes/knowledge/drafts/
  -> wiki audit
  -> wiki approve
  -> Joplin Data API
```

## Runtime Layout

第一版參考 Meeting Agent 的 macOS self-host 邊界，但不共用 repo：

```text
/Users/hermes/projects/hermes-wiki-engine
/Users/hermes/.local/bin/wiki
/Users/hermes/.hermes/skills/wiki/SKILL.md
/Users/hermes/knowledge/
  status.json
  lock
  logs/
  raw/
  compiled/
    schema.json
  graph/
  drafts/
  audit/
/Users/hermes/.config/hermes-knowledge/env
```

`/Users/hermes/.config/hermes-knowledge/env` 保存 Joplin token、Discord token、Telegram 設定。檔案權限必須是 `600`，不得進 git，不得印到 log。

正式乾淨 workspace 預定為：

```text
/Users/caiyijun/project/hermes-wiki-engine
```

目前 `meeting-agent/hermes-wiki-engine` 只是 planning spike。規劃收斂後，只搬必要骨架與文件到正式 workspace。

## CLI Contract

```text
wiki status
wiki sync
wiki compile
wiki query "問題"
wiki read <ref>
wiki links <ref>
wiki audit
wiki draft telegram ...
wiki draft discord ...
wiki draft consolidate --ref note:<id> ...
wiki approve <draft-id>
```

`wiki compile` 是完整更新知識庫：

```text
preflight
  -> Joplin Data API raw sync
  -> compile wiki summaries
  -> rebuild graph / index
  -> lint / health snapshot
  -> write status.json
```

`wiki sync` 是輕量背景工作：

```text
preflight
  -> Joplin Data API raw sync
  -> write status.json
```

`wiki query` 只讀已完成 cache / graph / index，不在前台對話臨時重編全庫。回答必須帶來源筆記或路徑；找不到來源時回報資料不足。

`wiki draft consolidate` 是背景整理入口。它只能從 operator 提供的整理內容與既有本機 refs 產生 reviewable draft，不得把整理結果直接放進 compiled pages 或寫回 Joplin。整理結果必須通過 `wiki approve`，再由下一輪 Joplin sync / compile 進入正式 read path。

`wiki audit` 是本機 governance 檢查。它檢查 dangling link、missing source、evidence gap、consolidation draft 缺 target 等 deterministic 問題，不做 semantic grading，也不呼叫 LLM。

## Background Job Model

第一版只用 lock file + status JSON，不做 queue 平台。

```text
wiki sync
  -> 如果 lock 存在，回報 busy
  -> 建 lock
  -> 執行 sync
  -> 寫 status
  -> 移除 lock

wiki compile
  -> preflight
  -> 如果 lock 存在，回報 busy
  -> 建 lock
  -> 執行完整 pipeline
  -> 寫 status
  -> 移除 lock
```

`wiki compile` 可用較大模型，例如 `gemma4:26b`，但必須非同步或可查狀態，不讓 Hermes 前台對話等待長任務完成。`wiki sync` 不使用大型模型。

## Joplin Data API Boundary

跨使用者整合不讀主使用者的 Joplin SQLite 或 profile。原因是權限、檔案鎖、profile 路徑與 Joplin 內部 schema 都不適合作為外部 API。

第一版 preflight 只檢查：

- Joplin Data API reachable。
- token 存在且未輸出。
- 可以列出 notebooks / notes metadata。
- knowledge state dir 可寫。
- lock 狀態可判斷。

approve 寫回 Joplin 時，只寫到指定 inbox notebook。未 approve 的 Telegram / Discord draft 只存在 filesystem。

## Capture Draft Flow

```text
Telegram allowlist chat
Discord personal server allowlist channel
  -> normalize message batch
  -> summarize / classify / redact
  -> /Users/hermes/knowledge/drafts/<draft-id>.md
  -> wiki approve <draft-id>
  -> Joplin Data API create note
```

第一版 Discord 定位是個人伺服器，不讀任意公開伺服器。Telegram 來源必須用 allowlisted chat id。附件、圖片、連結第一版只保存 metadata，不下載或 OCR。

Draft 必須包含 provenance：

```markdown
# Title

Source:
Channel:
Message range:
Created at:
Status: draft

## Summary
## Durable Knowledge
## Action Items
## Source Excerpts
## Writeback Recommendation
```

Consolidation draft 使用同一個 review gate，但來源是既有本機 refs：

```text
wiki draft consolidate --ref note:note-a --ref page:page-topic "整理內容"
  -> drafts/<draft-id>.json
  -> status: pending_review
  -> provenance.refs: ["note:note-a", "page:page-topic"]
  -> intended_target.conflict_behavior: manual_review
```

Hermes 可以協助建立 consolidation draft，但不得把 draft 當成 foreground answer source；回答記憶問題仍必須使用 `wiki query`、`wiki read`、`wiki links` 回傳的 source-backed evidence。

## First Slice

先做 retrieval 主線：

```text
wiki status
wiki sync
wiki compile
wiki query "問題"
```

`draft` / `approve` 留在 CLI contract，等 retrieval 主線穩定後再接 Telegram / Discord。

第一個實作 slice：

1. `wiki status` 讀寫 status JSON。
2. `wiki sync` 做 Joplin Data API preflight 與 notes metadata pull。
3. 最小 raw cache：只存 note id、title、updated_time、parent_id、body hash。
4. 單一 lock file。
5. Node 內建 `node:test` 測試 parse、status、lock、preflight 錯誤訊息。

## Runtime Boundary

- 背景服務以 `hermes` OS 使用者執行。
- Joplin Desktop 由主使用者執行。
- 跨使用者讀寫只透過 Joplin Data API。
- `wiki compile` 使用 lock file + status JSON，不先做 queue 平台。
- `wiki query` 不直接打 Joplin Data API 全庫搜尋。
- `wiki read` / `wiki links` / `wiki audit` 只讀寫本機 artifacts。
- `wiki draft consolidate` 不寫 raw cache、compiled pages、graph、audit 或 Joplin。
- `wiki approve` 是唯一 Joplin writeback 入口。

## Non-goals

- 不取代 Joplin。
- 不直接備份所有聊天紀錄。
- 不自動把 Telegram / Discord 寫入正式知識庫。
- 不在第一版做多使用者平台或 plugin framework。
- 不第一版支援多 Discord server。
- 不第一版做附件 OCR。
- 不第一版做全自動「值得保存」判斷。
- 不把 consolidation draft 自動升級為正式 compiled wiki page。
- 不在 foreground read path 加入 LLM、embedding、vector DB 或 RAG service。
