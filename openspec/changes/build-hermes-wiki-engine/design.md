## Context

Meeting Agent 已驗證一個適合 Hermes 的本機工具模式：獨立 hermes OS 使用者、LaunchDaemon 背景工作、Hermes skill 呼叫本機 command bridge、前台只查狀態或結果。Joplin-llm-wiki 則已驗證 Joplin 筆記同步、wiki 編譯、知識圖譜、workflow note guardrail 與 artifact 沉澱，但它不是為 Hermes 背景服務與跨使用者執行而設計。

新的 Hermes Wiki Engine 要吸收這兩邊經驗：Joplin 仍是長期知識庫 SSOT；Hermes 透過 wiki command bridge 查本機長期記憶；Telegram 與 Discord 個人伺服器只作為 capture source，必須先產生 draft，人工 approve 後才寫回 Joplin。

## Goals / Non-Goals

**Goals:**

- 建立乾淨 workspace：`/Users/caiyijun/project/hermes-wiki-engine`。
- 保留 `wiki` 作為使用者與 Hermes 看到的唯一 command bridge 名稱。
- 以 Joplin Data API 作為跨 macOS 使用者讀寫 Joplin 的唯一整合邊界。
- 先完成 retrieval 主線：`wiki status`、`wiki sync`、Joplin Data API preflight、raw metadata cache、lock file、`status.json`。
- 在規格上保留後續 `wiki compile`、`wiki query`、Telegram / Discord draft、approve writeback 的 contract。

**Non-Goals:**

- 不取代 Joplin，不直接讀主使用者的 Joplin SQLite 或 profile。
- 不把 Meeting Agent runtime 與 Hermes Wiki Engine 混在同一個產品邊界。
- 不在第一個 apply slice 實作 Telegram / Discord API、Joplin writeback、graph compile、附件 OCR 或多使用者平台。
- 不讓 Hermes 自動判斷所有聊天都值得保存；寫入長期知識庫必須經 draft / approve。

## Decisions

### Use a new clean workspace for the engine

正式實作 SHALL 搬到 `/Users/caiyijun/project/hermes-wiki-engine`。目前 `meeting-agent/hermes-wiki-engine` 只是 planning spike，搬遷時只帶 README、design、package metadata、CLI skeleton、tests、Hermes skill 草案。

Alternative considered: 在 Meeting Agent repo 內繼續實作。這會把會議處理與知識庫記憶引擎混在一起，之後也難以獨立安裝與部署。

### Use Joplin Data API as the integration boundary

Hermes Wiki Engine SHALL use Joplin Data API for full-library sync and approved writeback. It SHALL NOT read the main user's Joplin SQLite or profile files directly.

Alternative considered: 直接讀 SQLite。這在跨 macOS 使用者時會碰到權限、檔案鎖、profile path 與 Joplin 內部 schema drift，並且不適合作為 Hermes 背景服務的穩定 boundary。

### Keep wiki as a small command bridge

第一版 `wiki` SHALL expose a small CLI contract: `status`、`sync`、`compile`、`query`、`draft`、`approve`。第一個 apply slice SHALL implement only `status` and `sync` behavior plus explicit not-yet-implemented responses for the remaining commands.

Alternative considered: 先做 daemon / queue / HTTP server。這會在 Joplin Data API 與資料邊界尚未驗證前引入平台成本。

### Use lock file plus status JSON before queue infrastructure

`wiki sync` and `wiki compile` SHALL use one lock file to prevent concurrent jobs, and SHALL publish observable state through `status.json`. This is enough for Hermes to answer status questions without building a queue platform.

Alternative considered: 建立 job queue 與 worker。第一版只有一台本機、一個 hermes 使用者、一條 sync / compile pipeline，queue 屬於過早抽象。

### Split background ingestion from foreground retrieval

Background jobs SHALL update raw cache, compiled wiki, graph, and index. Foreground `wiki query` SHALL read completed cache / graph / index and SHALL NOT trigger full-library compile during a Hermes conversation.

Alternative considered: 每次 query 即時呼叫 Joplin Data API 搜全庫。這會慢、容易卡住 Hermes 前台對話，也會讓回答品質依賴 Joplin Desktop 當下狀態。

## Phased Implementation Contract

這個 change 保持單一 retrieval 主線，不拆成多個 change。分期順序採用成熟 retrieval pipeline 的最小版本：

```text
raw document store -> compiled local index -> query runtime
```

第一版先用 Node stdlib 與 JSON / Markdown 檔案，不新增 vector DB、embedding、LLM summary 或 graph。這讓每個 phase 都能獨立驗證，同時避免 `wiki query` 在 Hermes 前台對話時臨時碰 Joplin 或重編全庫。

### Phase 1: CLI skeleton and metadata sync

Observable behavior：

- Running `wiki status` before any sync prints JSON with `ok: true`, `state: "new"`, and a message telling the user to run sync or compile.
- Running `wiki sync` performs preflight checks for state directory writability, lock availability, Joplin Data API URL presence, token presence, and a minimal Joplin API request.
- If preflight fails, `wiki sync` prints JSON with `ok: false`, a stable `code`, and a user-safe message. It MUST NOT print token values.
- If another job lock exists, `wiki sync` prints JSON with `ok: false`, `code: "WIKI_BUSY"`, and the current status if available.
- On successful sync, the engine writes `status.json` and a raw metadata cache containing note id, title, parent id, updated time, and body hash. Phase 1 does not store full note bodies; Phase 2 adds body files under raw cache.
- `wiki compile`, `wiki query`, `wiki draft`, and `wiki approve` remain visible commands but return stable not-yet-implemented JSON until their own apply slices.

Data shapes:

```json
{
  "ok": true,
  "state": "synced",
  "last_job": "sync",
  "started_at": "2026-06-18T00:00:00.000Z",
  "finished_at": "2026-06-18T00:00:02.000Z",
  "notes_seen": 120,
  "warnings": []
}
```

```json
{
  "ok": false,
  "code": "JOPLIN_TOKEN_MISSING",
  "message": "Joplin Data API token is not configured."
}
```

Scope boundaries for Phase 1:

- In scope: workspace creation, package metadata, CLI skeleton, `wiki status`, `wiki sync`, preflight, lock file, status JSON, raw note metadata cache, Node built-in tests.
- Out of scope: full wiki compile, graph / index build, retrieval ranking, Telegram API, Discord API, approve writeback, LaunchDaemon installation, Hermes runtime installation.

Acceptance criteria for Phase 1:

- `npm test` passes in the clean workspace.
- `node src/wiki.js status` returns stable JSON with no secrets.
- `node src/wiki.js sync` reports a safe preflight error when Joplin env is missing.
- Tests cover parse behavior, status behavior, missing-token sync behavior, and lock busy behavior.
- No code path prints Joplin token, Discord token, Telegram token, or secret env file contents.

### Phase 2: Raw body cache

`wiki sync` SHALL keep using Joplin Data API and SHALL add note body files under raw cache:

```text
raw/
  notes-metadata.json
  notes/
    <note-id>.md
```

`notes-metadata.json` remains the compact manifest: `id`, `title`, `parent_id`, `updated_time`, and `body_hash`. The full note body is written to `raw/notes/<note-id>.md` so later compile and query work never need to call Joplin during foreground retrieval.

Phase 2 stays read-only against Joplin. It MUST NOT write notes, create notebooks, process Telegram or Discord, or install background jobs.

Acceptance criteria for Phase 2:

- `wiki sync` writes one body file per synced note.
- `notes-metadata.json` does not duplicate full note body content.
- Tests verify body files, hash stability, and token-safe failures.
- `wiki query` and `wiki compile` may still return not implemented.

### Phase 3: Thin compile

`wiki compile` SHALL read only `raw/notes-metadata.json` and `raw/notes/*.md`, then write the smallest useful compiled artifact:

```text
compiled/
  notes.json
```

Each compiled note contains `id`, `title`, `parent_id`, `updated_time`, `body_hash`, and `plain_text`. `plain_text` may be a simple Markdown-stripped text field using local code only. This phase deliberately skips graph, embeddings, LLM summary, tags, backlinks, and ranking infrastructure.

Acceptance criteria for Phase 3:

- `wiki compile` refuses to run when raw cache is missing.
- `wiki compile` does not call Joplin Data API.
- `compiled/notes.json` is deterministic for the same raw input.
- `status.json` records a successful compile job.

### Phase 4: Thin query

`wiki query` SHALL read only `compiled/notes.json` and perform a local keyword search with Node stdlib. It SHALL return source-backed results with note id, title, snippet, and a simple score. If no result matches, it SHALL return a user-facing "資料不足" response.

This phase proves the Hermes command bridge can retrieve local long-term memory before adding graph or semantic retrieval.

Acceptance criteria for Phase 4:

- `wiki query "問題"` does not call Joplin Data API.
- Results include note id, title, snippet, and score.
- Missing compiled index returns a stable user-safe error.
- No-match queries return "資料不足" rather than inventing an answer.

## Risks / Trade-offs

- [Risk] Joplin Desktop or Web Clipper API is not running when background sync starts. → Mitigation: preflight fails with a stable code and Hermes reports that Joplin Data API is unavailable.
- [Risk] Large full-library sync becomes slow. → Mitigation: first slice stores metadata only; later body sync can add pagination, incremental updated_time checks, and batching.
- [Risk] Draft capture pollutes long-term memory. → Mitigation: Telegram / Discord capture remains draft-only until explicit approve.
- [Risk] `gemma4:26b` makes compile slow. → Mitigation: `wiki sync` never uses large models; `wiki compile` is a background job with status reporting.
- [Risk] Planning spike diverges from the clean workspace. → Mitigation: copy only the minimal skeleton and Spectra artifacts into the clean workspace before implementation.

## Migration Plan

1. Keep the planning spike under `meeting-agent/hermes-wiki-engine` until the proposal is validated and parked.
2. Create `/Users/caiyijun/project/hermes-wiki-engine` as a clean workspace.
3. Copy only the minimal skeleton and docs from the spike.
4. Initialize git in the clean workspace if requested by the user.
5. Implement the first slice with Node stdlib and built-in `node:test`.
6. Later install the runtime for the hermes OS user at `/Users/hermes/projects/hermes-wiki-engine` after the local workspace is verified.

Rollback is simple before runtime installation: delete the clean workspace or discard its git branch. After runtime installation, remove the Hermes skill and command bridge without touching Joplin data.

## Open Questions

- The exact Joplin API URL and token env variable names will be finalized during the first apply slice.
- The approved Joplin inbox notebook name for writeback is intentionally deferred until the draft / approve slice.
