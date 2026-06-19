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
  candidates/
    consolidation-candidates.json
  review/
    consolidation-reviews.json
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
wiki draft consolidate --target-notebook <notebook-id> --ref note:<id> ...
wiki draft candidates --limit 10
wiki draft candidate <candidate-id> --target-notebook <notebook-id>
wiki draft reject <draft-id>
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

`wiki draft consolidate` 是 explicit-ref 背景整理入口。它從 operator 提供的整理目的與既有本機 refs 產生 source-backed reviewable draft。`note:` refs 只讀 `compiled/notes.json`，`page:` refs 只讀 `compiled/pages.json` 或 `compiled/pages/<id>.json`。找不到 compiled source 時 fail closed，不建立 draft。整理結果不得直接放進 compiled pages 或寫回 Joplin；必須通過 `wiki approve`，再由下一輪 Joplin sync / compile 進入正式 read path。

全筆記庫整理拆成三個 explicit phases：

1. Phase 1: `wiki draft consolidate --target-notebook ... --ref ...` 針對 operator 指定 refs 建立 deterministic extractive draft。內容保留 goal、source refs、source titles、bounded excerpts；若提供 target notebook，draft 會保存到 `intended_target.notebook_id`，但不寫回 Joplin。
2. Phase 2: `wiki draft candidates --limit N` 只讀 compiled artifacts，產生 bounded candidate list；候選使用 deterministic multi-signal scoring，包含 `reasons`、`score`、`priority`、`refs`、`goal`、`status`、`proposed_target`。目前 signals 包含 title prefix、same parent notebook、markdown links、shared page sources、recent update cluster。`wiki draft candidate <candidate-id>` 把選定候選轉成 reviewable consolidation draft。
3. Phase 3: local review artifacts 追蹤 pending、approved、rejected 與 rollback evidence；`wiki draft reject <draft-id>` 記錄 rejected evidence，`wiki approve <draft-id>` 成功後記錄 approved evidence 與 Joplin note id。

這個分期不承諾 LLM 摘要、embedding retrieval、語意去重或背景排程。候選探索先用 deterministic local heuristics，讓 operator 可以控制批次與審核負擔。

`wiki compile` 產生 source-backed topic/entity pages。單一 note 仍會保留相容的薄 page；同一 deterministic topic 與 parent context 下的多篇 notes 會聚合成 grouped page。page summary 與 sections 只使用 bounded source excerpts，每個 fact-bearing section 都保留 source note refs，不產生 unsupported facts。

`wiki audit` 是本機 governance 檢查。它檢查 dangling link、missing source、evidence gap、candidate refs 太少、consolidation draft 缺 target 等 deterministic 問題，也讀取 local review artifacts 輸出 pending、approved、rejected 統計；不做 semantic grading，也不呼叫 LLM。

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
  -> intended_target.notebook_id: "" 或 operator 指定 notebook
  -> intended_target.conflict_behavior: manual_review
```

Full-library candidate flow 仍使用同一個 review gate：

```text
wiki draft candidates --limit 10
  -> candidates/consolidation-candidates.json
  -> candidate_id、refs、reasons、score、priority、goal、status、proposed_target

wiki draft candidate <candidate-id> --target-notebook <notebook-id>
  -> drafts/<draft-id>.json
  -> kind: consolidate
  -> provenance.candidate_id
  -> intended_target.notebook_id
  -> review/consolidation-reviews.json decision: pending

wiki draft reject <draft-id>
  -> review/consolidation-reviews.json decision: rejected

wiki approve <draft-id>
  -> Joplin Data API create note
  -> review/consolidation-reviews.json decision: approved, joplin_note_id, rollback evidence
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
- `wiki draft candidates` 只讀 compiled artifacts，寫 bounded local candidate artifact，不寫 draft 或 Joplin。
- `wiki draft candidate` 只把已選候選轉成 filesystem draft 與 pending review evidence，不 approve。
- `wiki draft reject` 只寫 local review evidence，不寫 Joplin。
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
