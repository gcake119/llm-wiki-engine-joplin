## Context

`wiki automate once` is a one-shot maintenance command. It can be run manually or by an external scheduler. In the Hermes deployment, the `hermes` account does not have a GUI LaunchAgent domain, so a system LaunchDaemon with `UserName=hermes` is the appropriate macOS scheduling layer.

## Implementation Contract

- The repository MAY provide a macOS LaunchDaemon helper script, but the core CLI MUST remain one-shot and foreground-safe.
- The LaunchDaemon helper MUST run `wiki automate once`, not `wiki approve`.
- The LaunchDaemon plist MUST NOT include Joplin token values, env dumps, raw prompts, or note bodies.
- The helper MUST source an existing env file from the target user home.
- The helper MUST set a PATH that can find Node/pnpm-installed `wiki` in launchd's minimal environment.
- The helper MUST write stdout and stderr under the target user's logs directory.

## Verification

- `sh -n scripts/install-macos-launchdaemon.sh`
- `node --test --test-name-pattern "LaunchDaemon" test/wiki.test.js`
- `spectra validate add-macos-automation-launchdaemon-setup`
