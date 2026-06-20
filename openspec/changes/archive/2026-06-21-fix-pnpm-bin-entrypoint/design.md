## Context

`wiki` is installed as a package-manager bin. With pnpm, the executable path may be a shim or symlink rather than the real `src/wiki.js` path. The CLI must still detect direct execution and print `run()` output.

## Implementation Contract

- Direct execution detection MUST compare real filesystem paths instead of raw URL/string paths.
- Importing `src/wiki.js` from tests or other modules MUST NOT print CLI output.
- Executing a symlinked bin path MUST print the same output as direct execution.
- Rerank parsing MAY accept common Ollama JSON wrapper shapes such as single row objects, `data` arrays, and `results` arrays, but only after every returned ref is validated against known bounded candidates.
- Rerank prompt MUST ask for `reason` in Traditional Chinese by default, while allowing technical terms, product names, note titles, refs, and necessary names to stay in English or original text.
- The fix MUST NOT change Joplin access, source-ref validation, writeback behavior, or package manager configuration.

## Verification

- `node --test --test-name-pattern "package-manager symlink" test/wiki.test.js`
- `node --test --test-name-pattern "Ollama JSON wrapper|fails closed|rerank prompt distinguishes" test/wiki.test.js`
- `node --test test/wiki.test.js`
- `spectra validate fix-pnpm-bin-entrypoint`
- `pnpm test` in an environment where pnpm starts correctly
