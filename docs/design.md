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

## Open-Source Package Layout

公開 repo 是 `https://github.com/gcake119/llm-wiki-engine-joplin`。開源入口採 Node.js CLI package 形狀，並以 pnpm 作為預設 package manager：`package.json` 宣告 `packageManager`、`wiki` bin、Node engine、repository、license、keywords 與 package file list；不需要 build step、installer framework、daemon、HTTP server 或 GUI。

一般使用者的 portable profile 以 `WIKI_STATE_DIR` 指向 `$HOME/.local/state/hermes-wiki-engine`，並透過 `.env.example` 設定 `WIKI_JOPLIN_API_URL` 與 `WIKI_JOPLIN_TOKEN`。Hermes profile 仍可使用 `/Users/hermes/.local/bin/wiki` 與 `/Users/hermes/knowledge`，但這是進階部署路徑，不是開源 quickstart 前提。

開源檔案責任邊界：

- `README.md`：portable quickstart、command overview、Joplin writeback boundary。
- `.env.example`：placeholder-only local configuration，不含真實 secret。
- `SECURITY.md`：token、webhook、allowlist、state artifacts 與 approve-only writeback 邊界。
- `CONTRIBUTING.md`：Node.js、pnpm、node:test、Spectra workflow 與 secret hygiene。
- `docs/open-source-file-structure.md`：public package surface、runtime artifacts、repo governance、Hermes packaging 的分工。
- `packaging/hermes/skills/wiki/SKILL.md`：Hermes agent profile，仍必須使用 `query/read/links` 作為 foreground answer path，不能把 draft 或 semantic score 當成正式記憶。

開源化不承諾 npm publish、GitHub release、CI、package signing、自動 approve 或 hosted bot runtime。repo 可提供 macOS LaunchDaemon helper 安裝一輪一輪的整理排程，但正式寫回仍只允許 `wiki approve`。

## CLI Contract

```text
wiki status
wiki sync
wiki compile
wiki query "問題"
wiki query "問題" --rerank-llm
wiki read <ref>
wiki links <ref>
wiki audit
wiki automate once --draft-top <N> --notify
wiki automate status
wiki draft telegram ...
wiki draft discord ...
wiki draft consolidate --target-notebook <notebook-id> --ref note:<id> ...
wiki draft llm-consolidate --target-notebook <notebook-id> --ref note:<id> ...
wiki draft candidates --limit 10
wiki draft candidate <candidate-id> --target-notebook <notebook-id>
wiki draft reject <draft-id>
wiki semantic build
wiki semantic query "問題"
wiki capture telegram --input <path>
wiki capture discord --input <path>
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

`wiki query` 只讀已完成 cache / graph / index，不在前台對話臨時重編全庫。回答必須帶來源筆記或路徑；找不到來源時回報資料不足。若 operator 先跑過 `wiki semantic build`，foreground retrieval 可以參考 `wiki semantic query` 的 scored refs，但最終仍要回到 compiled page、`wiki read` 或 source refs 驗證；`wiki query` 不會隱性啟動 embedding build。

`wiki query "問題" --rerank-llm` 是 explicit query-rerank path，不是預設查詢。pipeline 是：

```text
compiled/notes.json
  -> deterministic keyword candidates, bounded to 20
  -> local LLM prompt with query, ref, title, parent id, snippet, keyword score
  -> strict JSON refs, relevance, reason
  -> source-backed top 5 results with keyword score and rerank metadata
```

query-rerank prompt 不包含 full raw note body、Joplin token、env dump、draft content 或 writeback payload。LLM 只能重排 bounded source refs，不能直接回答問題，也不能新增、修改或刪除 draft、automation、semantic、capture、review、raw、compiled 或 Joplin artifacts。provider missing、empty output、invalid JSON 或 only unknown refs 時回傳 `LLM_RERANK_UNAVAILABLE`，不得靜默降級成 deterministic query 並宣稱已 rerank。

`wiki draft consolidate` 是 explicit-ref 背景整理入口。它從 operator 提供的整理目的與既有本機 refs 產生 source-backed reviewable draft。`note:` refs 只讀 `compiled/notes.json`，`page:` refs 只讀 `compiled/pages.json` 或 `compiled/pages/<id>.json`。找不到 compiled source 時 fail closed，不建立 draft。整理結果不得直接放進 compiled pages 或寫回 Joplin；必須通過 `wiki approve`，再由下一輪 Joplin sync / compile 進入正式 read path。

`wiki draft llm-consolidate` 是 LLM-assisted review draft 入口。它只接受 compiled source refs，預設呼叫 local `ollama call` 或測試替身，輸出仍是 `kind: "consolidate"` 的 filesystem draft。draft 必須記錄 `provenance.llm`、source refs、prompt version、model 與 evidence status。LLM output 不是 foreground answer source，不能寫入 compiled pages，不能繞過 `wiki approve`。

全筆記庫整理拆成三個 explicit phases：

1. Phase 1: `wiki draft consolidate --target-notebook ... --ref ...` 針對 operator 指定 refs 建立 deterministic extractive draft。內容保留 goal、source refs、source titles、bounded excerpts；若提供 target notebook，draft 會保存到 `intended_target.notebook_id`，但不寫回 Joplin。
2. Phase 2: `wiki draft llm-consolidate --target-notebook ... --ref ...` 可用 local LLM 協助整理 source-backed summary、dedupe recommendation 與 open questions；provider 或 source missing 時 fail closed，不建立 partial draft。
3. Phase 3: `wiki draft candidates --limit N` 只讀 compiled artifacts，產生 bounded candidate list；候選使用 deterministic multi-signal scoring，包含 `reasons`、`score`、`priority`、`refs`、`goal`、`status`、`proposed_target`。目前 signals 包含 title prefix、same parent notebook、markdown links、shared page sources、recent update cluster。`wiki draft candidate <candidate-id>` 把選定候選轉成 reviewable consolidation draft。
4. Phase 4: local review artifacts 追蹤 pending、approved、rejected 與 rollback evidence；`wiki draft reject <draft-id>` 記錄 rejected evidence，`wiki approve <draft-id>` 成功後記錄 approved evidence 與 Joplin note id。
5. Phase 5: `wiki automate once --draft-top N --notify` 可由 Hermes、launchd、cron、macOS LaunchDaemon helper 或其他外部 runner 定期觸發。它會執行 sync、compile、candidate discovery、audit，然後最多替前 N 個 pending candidates 產生 LLM-assisted review drafts，並寫入 `automation/summaries/<run-id>.json`。`wiki automate status` 只讀 latest run 與 summary，不啟動背景工作。省略 `--draft-top` 或使用 `--draft-top 0` 時，只更新 evidence 與 candidates，不建立 LLM drafts。

這個分期仍不承諾內建常駐 daemon runtime、queue、dashboard、自動 target notebook 選擇或自動 approve。macOS LaunchDaemon helper 只是安裝外部排程器與 wrapper，候選探索先用 deterministic local heuristics，LLM 只協助建立待審草稿，讓 operator 可以控制批次與審核負擔。

Semantic retrieval 是可重建輔助索引，不是答案來源：

```text
wiki semantic build
  -> 只讀 compiled/pages.json
  -> semantic/index.json

wiki semantic query "問題"
  -> scored page refs / source refs / snippets
  -> operator 或 Hermes 再用 wiki read 驗證
```

semantic index missing、stale 或 provider missing 時，`wiki semantic query`／`wiki semantic build` 回傳明確狀態；既有 `wiki query`、`wiki read`、`wiki compile`、`wiki draft`、`wiki audit`、`wiki approve` 不被 semantic retrieval 阻塞。

`wiki compile` 產生 source-backed topic/entity pages。單一 note 仍會保留相容的薄 page；同一 deterministic topic 與 parent context 下的多篇 notes 會聚合成 grouped page。page summary 與 sections 只使用 bounded source excerpts，每個 fact-bearing section 都保留 source note refs，不產生 unsupported facts。

`wiki audit` 是本機 governance 檢查。它檢查 dangling link、missing source、evidence gap、candidate refs 太少、consolidation draft 缺 target 等 deterministic 問題，也讀取 local review artifacts 輸出 pending、approved、rejected 統計；不做 semantic grading，也不呼叫 LLM。

`wiki automate once --draft-top N --notify` 是定期全庫整理的 one-shot runner，不是常駐 scheduler。它可以由 Hermes、launchd、macOS LaunchDaemon helper 或 cron 定期呼叫；repo 可提供 macOS 安裝 helper，但核心責任仍是 CLI 執行與 artifacts。runner 會寫入 `automation/runs/<run-id>.json`、`automation/latest.json`、`automation/summaries/<run-id>.json`；notification 只包含 run id、候選數、draft 數、audit error 數與 warning，不包含 token、raw prompt 或 raw note body。LLM provider missing 只會成為 summary warning，不會抹掉 maintenance evidence。

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
  -> external adapter or Hermes normalizes message batch
  -> wiki capture telegram|discord --input <path>
  -> redact / dedupe / write capture run evidence
  -> /Users/hermes/knowledge/drafts/<draft-id>.json
  -> wiki approve <draft-id>
  -> Joplin Data API create note
```

第一版 Discord 定位是個人伺服器，不讀任意公開伺服器。Telegram 來源必須用 allowlisted chat id。repo 內不實作常駐 bot adapter，只接收 Hermes 或外部 process 傳入的 normalized JSON events。附件、圖片、連結第一版只保存 metadata，不下載或 OCR。

`wiki capture telegram --input <path>` 與 `wiki capture discord --input <path>` 只產生 filesystem draft 與 `capture/runs/<run-id>.json` evidence。disallowed、duplicate、rate-limited events 只記錄 rejection，不建立 draft，不寫回 Joplin。正式沉澱仍必須由 operator review 後執行 `wiki approve`。

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
LLM-assisted consolidation draft 遵守相同 gate：Hermes 可用它協助整理 refs，但不得把 LLM output 當成正式記憶答案，也不得宣稱已寫回 Joplin，除非 `wiki approve` 成功。

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
- `wiki automate status` 只讀 `automation/latest.json`、run artifact 與 summary，不觸發 sync、compile、LLM、semantic build、capture 或 approve。
- `wiki automate once --draft-top N --notify` 可由外部排程器或可選 macOS LaunchDaemon helper 定期呼叫，但核心 CLI 不內建常駐 daemon runtime，不自動選永久 target notebook，不自動 approve，不寫回 Joplin。
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
- 不在 repo 內建立常駐 scheduler daemon、launchd plist、cron job、queue service 或 dashboard。
- 不自動選擇永久 Joplin target notebook。
- 不在 foreground read path 隱性啟動 LLM、embedding、vector DB 或 RAG service。
