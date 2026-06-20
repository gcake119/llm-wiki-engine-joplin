# Contributing

## Local Setup

```zsh
npm install
cp .env.example .env
npm test
```

測試不需要真實 Joplin token。不要把 `.env`、state directory、raw cache 或 generated drafts 放進 git。

## Development Rules

- 使用 Node.js 20 或更新版本。
- 優先使用 Node stdlib，不為小工具新增 dependency。
- 保持 `wiki` CLI 小而直接。
- 前台記憶回答必須走 `wiki query`、`wiki read`、`wiki links` 的 source-backed evidence。
- `wiki approve` 是唯一正式 Joplin writeback gate。
- 文件或程式修改不得暗示 draft、candidate、audit、automation 或 capture 會直接寫回 Joplin。

## Spectra Workflow

需求、設計與任務使用 Spectra 管理：

```zsh
spectra validate
spectra analyze <change-name> --json
```

實作 change 時，依 `openspec/changes/<change-name>/tasks.md` 的 checkbox 更新進度。
