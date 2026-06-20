# Open-Source File Structure

這份文件描述公開 repo `https://github.com/gcake119/llm-wiki-engine-joplin` 的檔案責任邊界。

## Public Package Surface

- `package.json`：npm CLI metadata、`wiki` bin、Node engine、publish file list。
- `src/wiki.js`：CLI runtime。它是唯一 Node entrypoint。
- `README.md`：一般使用者 quickstart、command overview、安全邊界。
- `.env.example`：portable local configuration placeholder，不含真實 secret。
- `LICENSE`：開源授權。
- `SECURITY.md`：本機 secret、Joplin Data API、approve-only writeback 邊界。
- `CONTRIBUTING.md`：本機開發與 Spectra workflow。

## Runtime Artifacts

這些是使用者本機資料，不屬於 package surface，也不得進 git：

- `raw/`
- `compiled/`
- `graph/`
- `drafts/`
- `candidates/`
- `review/`
- `audit/`
- `automation/`
- `status.json`
- `lock`
- `.env`

開源 quickstart 使用 `WIKI_STATE_DIR` 指向 `$HOME/.local/state/hermes-wiki-engine`。Hermes runtime 可以改用 `/Users/hermes/knowledge`。

## Repo Governance

- `openspec/specs/`：已採用的能力規格。
- `openspec/changes/`：進行中或待 apply 的 Spectra changes。
- `docs/decisions/`：決策總帳與 ADR。
- `docs/design.md`：長期架構與 runtime 邊界。

這些檔案協助貢獻者理解設計，不是使用者的 runtime state。

## Hermes Packaging

- `packaging/hermes/skills/wiki/SKILL.md`：Hermes agent 的操作規則。

Hermes profile 可以使用絕對路徑 `/Users/hermes/.local/bin/wiki`，但公開 CLI 使用者不需要建立 `/Users/hermes`。Hermes 也必須遵守相同 writeback 邊界：前台回答走 `wiki query`、`wiki read`、`wiki links`；正式寫回只走 `wiki approve`。

## Publish Check

發布前先跑：

```zsh
npm test
npm pack --dry-run
```

檢查 tarball 應包含 source、docs、tests、specs 與 packaging guidance；不應包含 `.env`、state directory、raw cache、generated drafts、webhook URL 或 token。
