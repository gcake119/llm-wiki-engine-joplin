## ADDED Requirements

### Requirement: Open-source package metadata is complete

The Hermes Wiki Engine SHALL provide package metadata suitable for local npm packaging and installation as a CLI package without requiring a private Hermes runtime.

#### Scenario: Package metadata names the public repository

- **WHEN** a maintainer inspects package metadata for open-source readiness
- **THEN** the metadata SHALL include the repository URL `https://github.com/gcake119/llm-wiki-engine-joplin`
- **AND** it SHALL keep the `wiki` CLI bin mapped to the Node entrypoint
- **AND** it SHALL declare Node.js version compatibility

#### Scenario: Local package dry run excludes private state

- **WHEN** a maintainer runs the local package dry-run check
- **THEN** the package file list SHALL exclude local state directories, secret environment files, raw knowledge caches, generated runtime artifacts, and token-bearing files
- **AND** it SHALL include the CLI source, package metadata, README, license, security documentation, contribution guidance, environment example, tests, specs, and Hermes packaging guidance

### Requirement: Open-source documentation defines a portable install path

The Hermes Wiki Engine SHALL document a portable open-source installation and setup path that does not require the `/Users/hermes` OS user or Hermes-specific absolute paths.

#### Scenario: New user follows the README quickstart

- **WHEN** a new user reads the README quickstart
- **THEN** the quickstart SHALL instruct the user to install or link the CLI, copy the environment example, configure `WIKI_STATE_DIR`, configure Joplin Data API URL and token, run `wiki status`, and then run `wiki sync` or `wiki compile`
- **AND** the quickstart SHALL keep Hermes runtime setup separate from the primary open-source path

#### Scenario: File structure guide explains ownership boundaries

- **WHEN** a contributor reads the open-source file structure guide
- **THEN** the guide SHALL identify root project docs, CLI source, tests, Spectra specs, decision docs, environment examples, npm packaging controls, and Hermes packaging guidance as separate responsibility areas
- **AND** it SHALL explain which areas are public package surface and which areas are repo governance or deployment guidance

### Requirement: Open-source safety docs preserve Joplin writeback boundaries

The Hermes Wiki Engine SHALL document its secret-handling and writeback boundaries for open-source users without weakening the existing Joplin SSOT model.

#### Scenario: Security documentation describes token handling

- **WHEN** a user reads the security documentation or environment example
- **THEN** the documentation SHALL require Joplin tokens, Discord webhook URLs, Telegram allowlists, and Discord allowlists to be supplied through local environment configuration or equivalent local secret management
- **AND** it SHALL NOT include real token-looking values
- **AND** it SHALL warn users not to commit local environment files, state directories, raw caches, or generated drafts

#### Scenario: Documentation preserves approve-only writeback

- **WHEN** a user reads README, SECURITY, or Hermes packaging guidance
- **THEN** the documentation SHALL state that Joplin remains the long-term source of truth
- **AND** it SHALL state that Joplin integration uses Joplin Data API rather than direct SQLite or profile access
- **AND** it SHALL state that `wiki approve` is the only formal Joplin writeback gate
- **AND** it SHALL state that sync, compile, query, read, links, audit, candidate discovery, automation, capture, and draft creation SHALL NOT write Joplin notes
