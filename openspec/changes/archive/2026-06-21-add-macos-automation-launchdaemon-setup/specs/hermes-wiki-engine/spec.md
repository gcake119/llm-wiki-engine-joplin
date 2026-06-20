## MODIFIED Requirements

### Requirement: Hermes uses local wiki tools instead of RAG

The Hermes Wiki Engine SHALL expose local wiki artifacts and commands for Hermes. It MUST NOT introduce a hosted RAG service, vector database, cloud model retrieval step, or model-dependent default query path as part of read path hardening.

#### Scenario: macOS LaunchDaemon helper schedules review-gated automation

- **WHEN** an operator installs the macOS automation LaunchDaemon helper
- **THEN** the helper schedules `wiki automate once` through launchd as the Hermes user
- **AND** it writes logs under the Hermes user home
- **AND** it does not store Joplin tokens or other secrets in the LaunchDaemon plist
- **AND** it does not call `wiki approve`, create direct Joplin writeback, or bypass review-gated artifacts

#### Scenario: LaunchDaemon status can be verified with deterministic commands

- **WHEN** the LaunchDaemon is installed
- **THEN** documentation shows commands to inspect `launchctl print system/com.hermes.wiki-automate`
- **AND** documentation shows commands to inspect `wiki automate status`
- **AND** documentation shows commands to inspect recent automation run artifacts
