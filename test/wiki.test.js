import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { defaultStateDir, parseArgs, run } from "../src/wiki.js";

const projectRoot = path.resolve(import.meta.dirname, "..");

test("package metadata is ready for the public CLI package", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.description, "Local-first Joplin wiki engine for source-backed AI memory.");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.packageManager, "pnpm@11.5.0");
  assert.deepEqual(pkg.repository, {
    type: "git",
    url: "git+https://github.com/gcake119/llm-wiki-engine-joplin.git",
  });
  assert.equal(pkg.bin.wiki, "./src/wiki.js");
  assert.equal(pkg.engines.node, ">=20");
  assert.ok(pkg.keywords.includes("joplin"));
  assert.ok(pkg.keywords.includes("cli"));
  assert.ok(pkg.files.includes("src/"));
  assert.ok(pkg.files.includes("scripts/"));
  for (const expectedFile of ["README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md", ".env.example"]) {
    assert.ok(pkg.files.includes(expectedFile), `${expectedFile} must be in package files`);
  }
});

test("install script is published and documented", () => {
  const installScriptPath = path.join(projectRoot, "scripts", "install.sh");
  const installScript = fs.readFileSync(installScriptPath, "utf8");
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  const syntaxCheck = spawnSync("sh", ["-n", installScriptPath], { encoding: "utf8" });

  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr);
  assert.match(installScript, /codeload\.github\.com/);
  assert.match(installScript, /pnpm add -g/);
  assert.match(installScript, /\/dev\/tty/);
  assert.match(installScript, /Press Enter to accept a suggested value/);
  assert.match(installScript, /Suggested: %s/);
  assert.match(installScript, /WIKI_JOPLIN_TOKEN/);
  assert.match(installScript, /Joplin Desktop > Web Clipper > Advanced options/);
  assert.match(installScript, /hermes-wiki-engine"\nconfig_file="\$config_dir\/env"/);
  assert.match(installScript, /Node\.js 20 or newer is required/);
  assert.match(readme, /raw\.githubusercontent\.com\/gcake119\/llm-wiki-engine-joplin\/main\/scripts\/install\.sh/);
  assert.match(readme, /可以直接按 Enter 採用預設/);
  assert.match(readme, /source ~\/\.config\/hermes-wiki-engine\/env/);
});

test("environment example uses safe placeholders", () => {
  const envExample = fs.readFileSync(path.join(projectRoot, ".env.example"), "utf8");
  for (const key of [
    "WIKI_STATE_DIR",
    "WIKI_JOPLIN_API_URL",
    "WIKI_JOPLIN_TOKEN",
    "DISCORD_SYSTEM_WEBHOOK_URL",
    "WIKI_CAPTURE_TELEGRAM_ALLOWLIST",
    "WIKI_CAPTURE_DISCORD_ALLOWLIST",
    "WIKI_CAPTURE_RATE_LIMIT",
    "WIKI_LLM_MODEL",
  ]) {
    assert.match(envExample, new RegExp(`^(?:export )?${key}=`, "m"));
  }
  assert.doesNotMatch(envExample, /\b(?:sk|token|key)-[A-Za-z0-9_-]+\b/i);
  assert.doesNotMatch(envExample, /https:\/\/discord\.com\/api\/webhooks\/\d+\//);
});

test("README documents the portable install path and writeback gate", () => {
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  for (const text of [
    "pnpm add -g",
    "cp .env.example .env",
    "WIKI_STATE_DIR",
    "WIKI_JOPLIN_API_URL",
    "WIKI_JOPLIN_TOKEN",
    "wiki status",
    "wiki sync",
    "wiki compile",
    "/Users/hermes",
    "wiki approve",
  ]) {
    assert.match(readme, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("parses known commands", () => {
  assert.deepEqual(parseArgs(["compile"]), { command: "compile", rest: [] });
  assert.deepEqual(parseArgs(["query", "問題"]), { command: "query", rest: ["問題"] });
  assert.deepEqual(parseArgs(["read", "note-1"]), {
    command: "read",
    rest: ["note-1"],
  });
  assert.deepEqual(parseArgs(["links", "note-1"]), {
    command: "links",
    rest: ["note-1"],
  });
  assert.deepEqual(parseArgs(["audit"]), { command: "audit", rest: [] });
  assert.deepEqual(parseArgs(["notify", "discord"]), {
    command: "notify",
    rest: ["discord"],
  });
});

test("falls back to help for unknown commands", () => {
  assert.deepEqual(parseArgs(["wat"]), { command: "help", rest: [] });
  assert.deepEqual(parseArgs(["synthesize"]), { command: "help", rest: [] });
  assert.deepEqual(parseArgs(["error-book"]), { command: "help", rest: [] });
});

test("uses hermes knowledge state dir by default", () => {
  assert.equal(defaultStateDir({}), "/Users/hermes/knowledge");
  assert.equal(defaultStateDir({ WIKI_STATE_DIR: "/tmp/wiki" }), "/tmp/wiki");
});

test("query requires a question", async () => {
  assert.equal(await run(["query"]), "請在 wiki query 後面加上問題。");
});

test("cli prints output when executed through a package-manager symlink", () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-bin-"));
  const binPath = path.join(binDir, "wiki");
  fs.symlinkSync(path.join(projectRoot, "src", "wiki.js"), binPath);

  const result = spawnSync("node", [binPath, "query"], { encoding: "utf8", timeout: 5000 });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /請在 wiki query 後面加上問題。/);
});

test("status returns fresh state when status file is absent", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-status-"));
  const result = JSON.parse(await run(["status"], { WIKI_STATE_DIR: stateDir }));
  assert.equal(result.ok, true);
  assert.equal(result.state, "new");
  assert.match(result.message, /wiki sync/);
});

test("status returns persisted status json", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-status-"));
  const statusPath = path.join(stateDir, "status.json");
  fs.writeFileSync(
    statusPath,
    JSON.stringify({ ok: true, state: "synced", notes_seen: 2 }),
  );

  const result = JSON.parse(await run(["status"], { WIKI_STATE_DIR: stateDir }));
  assert.deepEqual(result, { ok: true, state: "synced", notes_seen: 2 });
});

test("sync fails safely when token is missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const result = JSON.parse(await run(["sync"], { WIKI_STATE_DIR: stateDir }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_TOKEN_MISSING");
  assert.doesNotMatch(JSON.stringify(result), /token-value/);
});

test("sync fails safely when state directory is unavailable", async () => {
  const stateFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-")),
    "not-a-directory",
  );
  fs.writeFileSync(stateFile, "");

  const result = JSON.parse(
    await run(["sync"], {
      WIKI_STATE_DIR: stateFile,
      WIKI_JOPLIN_TOKEN: "token-value",
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_STATE_DIR_UNAVAILABLE");
});

test("sync refuses to start when lock exists", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  fs.writeFileSync(path.join(stateDir, "lock"), "running\n");

  const result = JSON.parse(
    await run(["sync"], {
      WIKI_STATE_DIR: stateDir,
      WIKI_JOPLIN_TOKEN: "token-value",
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_BUSY");
});

test("sync fails safely when Joplin API is unavailable", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const result = JSON.parse(
    await run(
      ["sync"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      {
        fetchImpl: async () => {
          throw new Error("connect failed");
        },
      },
    ),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_API_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(result), /token-value/);
});

test("sync writes status and raw metadata cache", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const nowValues = [
    new Date("2026-06-18T00:00:00.000Z"),
    new Date("2026-06-18T00:00:02.000Z"),
  ];
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-1",
            title: "First note",
            parent_id: "folder-1",
            updated_time: 123,
            body: "secret body",
          },
        ],
      }),
    };
  };

  const result = JSON.parse(
    await run(
      ["sync"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl, now: () => nowValues.shift() },
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "synced");
  assert.equal(result.notes_seen, 1);
  const statusJson = JSON.parse(
    fs.readFileSync(path.join(stateDir, "status.json"), "utf8"),
  );
  assert.equal(statusJson.last_job, "sync");

  const cache = JSON.parse(
    fs.readFileSync(path.join(stateDir, "raw", "notes-metadata.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(cache.notes[0]), [
    "id",
    "title",
    "parent_id",
    "updated_time",
    "body_hash",
  ]);
  assert.equal(cache.notes[0].id, "note-1");
  assert.notEqual(cache.notes[0].body_hash, "");
  assert.doesNotMatch(JSON.stringify(cache), /secret body/);
});

test("sync writes raw note body files with stable metadata hash", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const nowValues = [
    new Date("2026-06-18T00:00:00.000Z"),
    new Date("2026-06-18T00:00:02.000Z"),
    new Date("2026-06-18T00:00:03.000Z"),
    new Date("2026-06-18T00:00:05.000Z"),
  ];
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-1",
            title: "First note",
            parent_id: "folder-1",
            updated_time: 123,
            body: "# Heading\n\nStable body",
          },
        ],
      }),
    };
  };

  const env = {
    WIKI_STATE_DIR: stateDir,
    WIKI_JOPLIN_TOKEN: "token-value",
  };
  await run(["sync"], env, { fetchImpl, now: () => nowValues.shift() });
  const firstCache = JSON.parse(
    fs.readFileSync(path.join(stateDir, "raw", "notes-metadata.json"), "utf8"),
  );

  await run(["sync"], env, { fetchImpl, now: () => nowValues.shift() });
  const secondCache = JSON.parse(
    fs.readFileSync(path.join(stateDir, "raw", "notes-metadata.json"), "utf8"),
  );

  assert.equal(
    fs.readFileSync(path.join(stateDir, "raw", "notes", "note-1.md"), "utf8"),
    "# Heading\n\nStable body",
  );
  assert.equal(firstCache.notes[0].body_hash, secondCache.notes[0].body_hash);
  assert.doesNotMatch(JSON.stringify(secondCache), /Stable body/);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
});

test("sync fetches all Joplin note pages", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const notePageUrls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    notePageUrls.push(String(url));
    const page = parsed.searchParams.get("page") || "1";
    if (page === "1") {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "note-a",
              title: "First note",
              parent_id: "folder-1",
              updated_time: 123,
              body: "page one",
            },
          ],
          has_more: true,
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-b",
            title: "Second note",
            parent_id: "folder-1",
            updated_time: 456,
            body: "page two",
          },
        ],
          has_more: false,
        }),
    };
  };

  const result = JSON.parse(
    await run(
      ["sync"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.notes_seen, 2);
  assert.equal(result.notes_written, 2);
  assert.equal(result.pages_seen, 2);
  assert.deepEqual(result.warnings, []);
  assert.equal(notePageUrls.length, 2);
  assert.equal(new URL(notePageUrls[1]).searchParams.get("page"), "2");

  const cache = JSON.parse(
    fs.readFileSync(path.join(stateDir, "raw", "notes-metadata.json"), "utf8"),
  );
  assert.deepEqual(cache.notes.map((note) => note.id), ["note-a", "note-b"]);
  assert.equal(
    fs.readFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "utf8"),
    "page one",
  );
  assert.equal(
    fs.readFileSync(path.join(stateDir, "raw", "notes", "note-b.md"), "utf8"),
    "page two",
  );

  const statusJson = JSON.parse(
    fs.readFileSync(path.join(stateDir, "status.json"), "utf8"),
  );
  assert.equal(statusJson.notes_seen, 2);
  assert.equal(statusJson.notes_written, 2);
  assert.equal(statusJson.pages_seen, 2);
  assert.deepEqual(statusJson.warnings, []);
});

test("sync --notify sends a system notification after success", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    if (pathname.endsWith("/notes")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "note-1",
              title: "First note",
              parent_id: "folder-1",
              updated_time: 123,
              body: "body",
            },
          ],
        }),
      };
    }
    return { ok: true };
  };

  const result = JSON.parse(
    await run(
      ["sync", "--notify"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
        DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/id/token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.notification.ok, true);
  assert.equal(result.notification.target, "discord_system");
  const notifyCall = calls.find((call) => call.options.method === "POST");
  assert.ok(notifyCall);
  assert.deepEqual(JSON.parse(notifyCall.options.body), {
    content: "[Hermes Wiki] sync 成功：notes_seen=1",
  });
  assert.doesNotMatch(JSON.stringify(result), /token-value/);
});

test("sync --notify reports primary failure and notification result separately", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return { ok: true };
  };

  const result = JSON.parse(
    await run(
      ["sync", "--notify"],
      {
        WIKI_STATE_DIR: stateDir,
        DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/id/token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_TOKEN_MISSING");
  assert.equal(result.notification.ok, true);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    content: "[Hermes Wiki] sync 失敗：JOPLIN_TOKEN_MISSING",
  });
  assert.doesNotMatch(JSON.stringify(result), /token-value/);
});

test("sync rejects unsafe note ids before writing body files", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const outsidePath = path.join(stateDir, "escaped.md");
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "../escaped",
            title: "Bad note",
            parent_id: "folder-1",
            updated_time: 123,
            body: "should not escape",
          },
        ],
      }),
    };
  };

  const result = JSON.parse(
    await run(
      ["sync"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_NOTE_ID_UNSAFE");
  assert.equal(fs.existsSync(outsidePath), false);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
});

test("sync rejects notes missing a string body before writing trusted cache", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-sync-"));
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-1",
            title: "Missing body",
            parent_id: "folder-1",
            updated_time: 123,
          },
        ],
        has_more: false,
      }),
    };
  };

  const result = JSON.parse(
    await run(
      ["sync"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_NOTE_BODY_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "raw", "notes-metadata.json")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "raw", "notes", "note-1.md")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
});

test("compile fails safely when raw cache is missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  const result = JSON.parse(await run(["compile"], { WIKI_STATE_DIR: stateDir }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_RAW_CACHE_MISSING");
  assert.match(result.message, /wiki sync/);
  assert.equal(fs.existsSync(path.join(stateDir, "compiled", "notes.json")), false);
});

test("compile writes deterministic compiled notes from raw cache only", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes-metadata.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-1",
          title: "First note",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-1",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes", "note-1.md"),
    "# Heading\n\nA **durable** wiki note.",
  );
  const nowValues = [
    new Date("2026-06-18T01:00:00.000Z"),
    new Date("2026-06-18T01:00:02.000Z"),
    new Date("2026-06-18T01:00:03.000Z"),
    new Date("2026-06-18T01:00:05.000Z"),
  ];
  const fetchImpl = async () => {
    throw new Error("compile must not call Joplin");
  };
  const deps = { fetchImpl, now: () => nowValues.shift() };

  const firstResult = JSON.parse(
    await run(["compile"], { WIKI_STATE_DIR: stateDir }, deps),
  );
  const firstCompiled = fs.readFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    "utf8",
  );
  const firstGraphPath = path.join(stateDir, "graph", "graph.json");
  const firstGraph = fs.readFileSync(firstGraphPath, "utf8");
  const firstPagesPath = path.join(stateDir, "compiled", "pages.json");
  const firstPages = fs.readFileSync(firstPagesPath, "utf8");
  const secondResult = JSON.parse(
    await run(["compile"], { WIKI_STATE_DIR: stateDir }, deps),
  );
  const secondCompiled = fs.readFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    "utf8",
  );
  const secondGraph = fs.readFileSync(firstGraphPath, "utf8");
  const secondPages = fs.readFileSync(firstPagesPath, "utf8");

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.last_job, "compile");
  assert.equal(firstResult.notes_compiled, 1);
  assert.equal(firstCompiled, secondCompiled);
  assert.equal(firstGraph, secondGraph);
  assert.equal(firstPages, secondPages);
  assert.equal(secondResult.ok, true);

  const compiled = JSON.parse(firstCompiled);
  const graph = JSON.parse(firstGraph);
  const pages = JSON.parse(firstPages);
  const pageFilePath = path.join(stateDir, "compiled", "pages", "page-note-1.json");
  const pageFile = JSON.parse(fs.readFileSync(pageFilePath, "utf8"));
  assert.deepEqual(compiled.notes, [
    {
      id: "note-1",
      title: "First note",
      parent_id: "folder-1",
      updated_time: 123,
      body_hash: "hash-1",
      plain_text: "Heading A durable wiki note.",
    },
  ]);
  assert.deepEqual(graph.nodes, [
    {
      id: "note-1",
      type: "note",
      title: "First note",
    },
  ]);
  assert.deepEqual(graph.edges, [
    {
      from: "note-1",
      to: "folder-1",
      type: "notebook_parent",
    },
  ]);
  assert.deepEqual(pages.pages, [
    {
      page_id: "page-note-1",
      title: "First note",
      aliases: [],
      tags: [],
      summary: "Heading A durable wiki note.",
      sections: [
        {
          heading: "Source note",
          text: "Heading A durable wiki note.",
          sources: ["note-1"],
        },
      ],
      links: [],
      sources: ["note-1"],
    },
  ]);
  assert.deepEqual(pageFile, pages.pages[0]);
  assert.equal(pages.pages[0].sections.every((section) => section.sources.length > 0), true);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
  const statusJson = JSON.parse(
    fs.readFileSync(path.join(stateDir, "status.json"), "utf8"),
  );
  assert.equal(statusJson.last_job, "compile");
  assert.equal(statusJson.notes_compiled, 1);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
});

test("compile adds graph edges for resolvable Markdown note links only", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes-metadata.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-1",
          title: "First note",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-1",
        },
        {
          id: "note-2",
          title: "Second note",
          parent_id: "folder-1",
          updated_time: 124,
          body_hash: "hash-2",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes", "note-1.md"),
    "See [Second](:/note-2) and [Missing](:/missing-note).",
  );
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-2.md"), "Target");

  const result = JSON.parse(await run(["compile"], { WIKI_STATE_DIR: stateDir }));
  const graph = JSON.parse(
    fs.readFileSync(path.join(stateDir, "graph", "graph.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    graph.edges.filter((edge) => edge.type === "markdown_link"),
    [
      {
        from: "note-1",
        to: "note-2",
        type: "markdown_link",
      },
    ],
  );
});

test("compile writes a local wiki schema artifact", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes-metadata.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Schema source",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-a",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "Body");
  const fetchImpl = async () => {
    throw new Error("compile schema must stay local");
  };

  const result = JSON.parse(
    await run(["compile"], { WIKI_STATE_DIR: stateDir }, { fetchImpl }),
  );
  const schema = JSON.parse(
    fs.readFileSync(path.join(stateDir, "compiled", "schema.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(typeof schema.schema_version, "number");
  assert.deepEqual(schema.ref_kinds, ["note", "page"]);
  assert.ok(schema.draft_kinds.includes("consolidate"));
  assert.ok(schema.page_model);
  assert.ok(schema.governance_rules.includes("source_required"));
});

test("compile --notify sends success and failure system notifications", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return { ok: true };
  };
  const env = {
    WIKI_STATE_DIR: stateDir,
    DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/id/token-value",
  };

  const missingRaw = JSON.parse(
    await run(["compile", "--notify"], env, { fetchImpl }),
  );
  assert.equal(missingRaw.ok, false);
  assert.equal(missingRaw.code, "WIKI_RAW_CACHE_MISSING");
  assert.equal(missingRaw.notification.ok, true);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    content: "[Hermes Wiki] compile 失敗：WIKI_RAW_CACHE_MISSING",
  });

  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes-metadata.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-1",
          title: "First note",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-1",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-1.md"), "body");

  const compiled = JSON.parse(await run(["compile", "--notify"], env, { fetchImpl }));
  assert.equal(compiled.ok, true);
  assert.equal(compiled.notification.ok, true);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    content: "[Hermes Wiki] compile 成功：notes_compiled=1",
  });
  assert.doesNotMatch(JSON.stringify(compiled), /token-value/);
});

test("query fails safely when compiled index is missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  const result = JSON.parse(
    await run(["query", "durable"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_COMPILED_INDEX_MISSING");
  assert.match(result.message, /wiki compile/);
});

test("query returns source-backed local keyword results", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-1",
          title: "Durable memory",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-1",
          plain_text: "A durable wiki note for Hermes retrieval.",
        },
        {
          id: "note-2",
          title: "Other",
          parent_id: "folder-1",
          updated_time: 124,
          body_hash: "hash-2",
          plain_text: "Unrelated text.",
        },
      ],
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("query must not call Joplin");
  };

  const result = JSON.parse(
    await run(["query", "durable", "wiki"], { WIKI_STATE_DIR: stateDir }, { fetchImpl }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.evidence_status, "source_backed");
  assert.equal(result.results.length, 1);
  assert.deepEqual(Object.keys(result.results[0]), [
    "ref",
    "kind",
    "id",
    "title",
    "parent_id",
    "snippet",
    "score",
  ]);
  assert.equal(result.results[0].ref, "note:note-1");
  assert.equal(result.results[0].kind, "note");
  assert.equal(result.results[0].id, "note-1");
  assert.equal(result.results[0].title, "Durable memory");
  assert.equal(result.results[0].parent_id, "folder-1");
  assert.match(result.results[0].snippet, /durable wiki/);
  assert.ok(result.results[0].score > 0);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "compiled", "pages.json")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});

test("query ranks title matches before body-only matches", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "b",
          title: "Other",
          plain_text: "Local retrieval",
        },
        {
          id: "a",
          title: "Local retrieval",
          plain_text: "Hermes wiki",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["query", "local", "retrieval"],
      { WIKI_STATE_DIR: stateDir },
      { llmProvider: async () => { throw new Error("query must not call LLM by default"); } },
    ),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.results.map((note) => note.id), ["a", "b"]);
});

test("query reranks bounded keyword candidates with local LLM", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-keyboard",
          title: "Gamdias Hermes keyboard",
          parent_id: "folder-keyboard",
          plain_text: "Hermes Ultimate keyboard",
        },
        {
          id: "note-memory",
          title: "Hermes Wiki Engine",
          parent_id: "folder-memory",
          plain_text: "Joplin long-term memory for Hermes",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["query", "Hermes", "長期記憶", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir, WIKI_LLM_MODEL: "local-test" },
      {
        llmProvider: async () => ({
          provider: "test",
          model: "local-test",
          text: JSON.stringify([
            { ref: "note:note-memory", relevance: 0.95, reason: "Hermes memory note" },
            { ref: "note:note-keyboard", relevance: 0.2, reason: "keyboard article" },
          ]),
        }),
      },
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "reranked");
  assert.equal(result.evidence_status, "source_backed");
  assert.deepEqual(result.results.map((note) => note.ref), [
    "note:note-memory",
    "note:note-keyboard",
  ]);
  assert.equal(result.results[0].score > 0, true);
  assert.equal(result.results[0].rerank_score, 0.95);
  assert.equal(result.results[0].rerank_reason, "Hermes memory note");
  assert.equal(result.rerank.provider, "test");
  assert.equal(result.rerank.model, "local-test");
  assert.equal(result.rerank.prompt_version, "query-rerank-v1");
});

test("query rerank accepts fenced JSON array from local LLM", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-memory",
          title: "Hermes Wiki Engine",
          parent_id: "folder-memory",
          plain_text: "Hermes long-term memory",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir, WIKI_LLM_MODEL: "local-test" },
      {
        llmProvider: async () => ({
          provider: "test",
          model: "local-test",
          text: "```json\n[{\"ref\":\"note:note-memory\",\"relevance\":1,\"reason\":\"memory\"}]\n```",
        }),
      },
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "reranked");
  assert.equal(result.results[0].ref, "note:note-memory");
});

test("query rerank uses Ollama API JSON mode by default", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-memory",
          title: "Hermes Wiki Engine",
          parent_id: "folder-memory",
          plain_text: "Hermes long-term memory",
        },
      ],
    })}\n`,
  );
  let body;

  const result = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir, WIKI_LLM_MODEL: "local-test" },
      {
        fetchImpl: async (_url, options) => {
          body = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({
              response: JSON.stringify([
                { ref: "note:note-memory", relevance: 1, reason: "memory" },
              ]),
            }),
          };
        },
      },
    ),
  );

  assert.equal(body.model, "local-test");
  assert.equal(body.stream, false);
  assert.equal(body.format, "json");
  assert.match(body.prompt, /\[\{"ref":"note:<copy candidate ref>","relevance":0\.0,"reason":"short reason"\}\]/);
  assert.equal(result.ok, true);
  assert.equal(result.state, "reranked");
  assert.equal(result.results[0].ref, "note:note-memory");
});

test("query rerank prompt only includes bounded candidate metadata", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: Array.from({ length: 25 }, (_, index) => ({
        id: `note-${index + 1}`,
        title: `Hermes candidate ${index + 1}`,
        parent_id: "folder-1",
        plain_text: `Hermes snippet ${index + 1} token-value draft content. FULL_RAW_BODY_${index + 1}`,
      })),
    })}\n`,
  );
  let prompt = "";

  await run(
    ["query", "Hermes", "--rerank-llm"],
    {
      WIKI_STATE_DIR: stateDir,
      WIKI_JOPLIN_TOKEN: "token-value",
      WIKI_LLM_MODEL: "local-test",
    },
    {
      llmProvider: async ({ prompt: value }) => {
        prompt = value;
        return {
          provider: "test",
          model: "local-test",
          text: JSON.stringify([{ ref: "note:note-1", relevance: 1, reason: "top" }]),
        };
      },
    },
  );

  const candidates = [...prompt.matchAll(/"ref": "note:/g)];
  assert.equal(candidates.length, 20);
  assert.match(prompt, /"query": "Hermes"/);
  assert.match(prompt, /"title": "Hermes candidate 1"/);
  assert.match(prompt, /"parent_id": "folder-1"/);
  assert.match(prompt, /"snippet":/);
  assert.match(prompt, /"score":/);
  assert.doesNotMatch(prompt, /FULL_RAW_BODY_1/);
  assert.doesNotMatch(prompt, /token-value/);
  assert.doesNotMatch(prompt, /draft content/);
  assert.doesNotMatch(prompt, /WIKI_JOPLIN_TOKEN/);
});

test("query rerank prompt asks for Traditional Chinese reasons", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-memory",
          title: "Hermes Wiki Engine",
          parent_id: "folder-memory",
          plain_text: "Joplin 長期記憶 system for Hermes wiki engine",
        },
      ],
    })}\n`,
  );
  let prompt = "";

  await run(
    ["query", "Hermes", "wiki", "engine", "Joplin", "長期記憶", "--rerank-llm"],
    { WIKI_STATE_DIR: stateDir, WIKI_LLM_MODEL: "local-test" },
    {
      llmProvider: async ({ prompt: value }) => {
        prompt = value;
        return {
          provider: "test",
          model: "local-test",
          text: JSON.stringify([{ ref: "note:note-memory", relevance: 1, reason: "top" }]),
        };
      },
    },
  );

  assert.match(prompt, /Traditional Chinese/i);
  assert.match(prompt, /繁體中文/);
  assert.match(prompt, /technical terms, product names, note titles, refs, and necessary names/i);
  assert.match(prompt, /Return only the completed JSON array/);
  assert.doesNotMatch(prompt, /answer the question/i);
});

test("query rerank accepts common Ollama JSON wrapper shapes", async () => {
  const cases = [
    {
      name: "single object",
      text: JSON.stringify({ ref: "note:note-memory", relevance: 0.9, reason: "single" }),
      reason: "single",
    },
    {
      name: "data array",
      text: JSON.stringify({
        data: [{ ref: "note:note-memory", relevance: 0.8, reason: "data" }],
      }),
      reason: "data",
    },
    {
      name: "results array",
      text: JSON.stringify({
        results: [{ ref: "note:note-memory", relevance: 0.7, reason: "results" }],
      }),
      reason: "results",
    },
  ];

  for (const item of cases) {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
    fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "compiled", "notes.json"),
      `${JSON.stringify({
        notes: [
          {
            id: "note-memory",
            title: "Hermes Wiki Engine",
            parent_id: "folder-memory",
            plain_text: "Joplin 長期記憶 system for Hermes wiki engine",
          },
        ],
      })}\n`,
    );

    const result = JSON.parse(
      await run(
        ["query", "Hermes", "wiki", "engine", "Joplin", "長期記憶", "--rerank-llm"],
        { WIKI_STATE_DIR: stateDir, WIKI_LLM_MODEL: "local-test" },
        {
          llmProvider: async () => ({
            provider: "test",
            model: "local-test",
            text: item.text,
          }),
        },
      ),
    );

    assert.equal(result.ok, true, item.name);
    assert.equal(result.state, "reranked", item.name);
    assert.equal(result.results[0].ref, "note:note-memory", item.name);
    assert.equal(result.results[0].rerank_reason, item.reason, item.name);
  }
});

test("query rerank fails closed when local LLM output is unavailable", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-memory",
          title: "Hermes memory",
          plain_text: "Hermes memory source body token-value",
        },
      ],
    })}\n`,
  );

  const missing = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir },
      {
        fetchImpl: null,
        execFileSync: (command, args) => {
          assert.equal(command, "ollama");
          assert.deepEqual(args, ["run", "gemma3:12b"]);
          throw new Error("missing ollama");
        },
      },
    ),
  );
  const invalidJson = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir },
      { llmProvider: async () => ({ provider: "test", model: "local-test", text: "not json" }) },
    ),
  );
  const unknownRefs = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir },
      {
        llmProvider: async () => ({
          provider: "test",
          model: "local-test",
          text: JSON.stringify([{ ref: "note:unknown", relevance: 1, reason: "bad" }]),
        }),
      },
    ),
  );
  const wrappedUnknownRefs = JSON.parse(
    await run(
      ["query", "Hermes", "memory", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir },
      {
        llmProvider: async () => ({
          provider: "test",
          model: "local-test",
          text: JSON.stringify({
            data: [{ ref: "note:unknown", relevance: 1, reason: "bad" }],
          }),
        }),
      },
    ),
  );

  for (const result of [missing, invalidJson, unknownRefs, wrappedUnknownRefs]) {
    assert.equal(result.ok, false);
    assert.equal(result.code, "LLM_RERANK_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result), /token-value|Hermes memory source body|prompt|stack/i);
    assert.equal(Object.hasOwn(result, "results"), false);
  }
});

test("query rerank remains foreground read-only", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-memory",
          title: "Hermes memory",
          parent_id: "folder-1",
          plain_text: "Hermes memory",
        },
      ],
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("query rerank must not call Joplin");
  };

  const result = JSON.parse(
    await run(
      ["query", "Hermes", "--rerank-llm"],
      { WIKI_STATE_DIR: stateDir },
      {
        fetchImpl,
        llmProvider: async () => ({
          provider: "test",
          model: "local-test",
          text: JSON.stringify([{ ref: "note:note-memory", relevance: 1, reason: "memory" }]),
        }),
      },
    ),
  );

  assert.equal(result.ok, true);
  for (const artifact of ["drafts", "automation", "semantic", "capture", "review", "raw"]) {
    assert.equal(fs.existsSync(path.join(stateDir, artifact)), false);
  }
  assert.equal(fs.existsSync(path.join(stateDir, "compiled", "pages.json")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "compiled", "notes.json")), true);
});

test("query limits result count to the default top five", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: Array.from({ length: 6 }, (_, index) => ({
        id: `note-${index + 1}`,
        title: `Local retrieval ${index + 1}`,
        plain_text: "Hermes wiki",
      })),
    })}\n`,
  );

  const result = JSON.parse(
    await run(["query", "local"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.results.length, 5);
});

test("query reports insufficient data for no matches", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-query-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-1",
          title: "Durable memory",
          plain_text: "A durable wiki note.",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["query", "missing"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "insufficient_data");
  assert.equal(result.evidence_status, "insufficient");
  assert.equal(result.message, "資料不足");
  assert.deepEqual(result.results, []);
});

test("read returns a source-backed local note by id", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-read-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "Raw body");
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Local retrieval",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-a",
          plain_text: "Hermes wiki local retrieval works",
        },
      ],
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("read must not call Joplin");
  };

  const result = JSON.parse(
    await run(["read", "note-a"], { WIKI_STATE_DIR: stateDir }, { fetchImpl }),
  );

  assert.deepEqual(result, {
    ok: true,
    id: "note-a",
    title: "Local retrieval",
    parent_id: "folder-1",
    body_hash: "hash-a",
    plain_text: "Hermes wiki local retrieval works",
    source: {
      artifact: "compiled/notes.json",
      raw_body: "raw/notes/note-a.md",
    },
    evidence_status: "source_backed",
  });
});

test("read returns not_found evidence status for an unknown note id", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-read-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "Raw body");
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Local retrieval",
          body_hash: "hash-a",
          plain_text: "Hermes wiki local retrieval works",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["read", "missing-note"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "NOTE_NOT_FOUND");
  assert.equal(result.evidence_status, "not_found");
});

test("read accepts explicit note and page refs", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-read-"));
  fs.mkdirSync(path.join(stateDir, "compiled", "pages"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "Raw body");
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Local retrieval",
          parent_id: "folder-1",
          body_hash: "hash-a",
          plain_text: "Hermes wiki local retrieval works",
        },
      ],
    })}\n`,
  );
  const page = {
    page_id: "page-note-a",
    title: "Local retrieval",
    aliases: [],
    tags: [],
    summary: "Hermes wiki local retrieval works",
    sections: [
      {
        heading: "Source note",
        text: "Hermes wiki local retrieval works",
        sources: ["note-a"],
      },
    ],
    links: [],
    sources: ["note-a"],
  };
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({ pages: [page] })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages", "page-note-a.json"),
    `${JSON.stringify(page)}\n`,
  );

  const noteResult = JSON.parse(
    await run(["read", "note:note-a"], { WIKI_STATE_DIR: stateDir }),
  );
  const pageResult = JSON.parse(
    await run(["read", "page:page-note-a"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(noteResult.ok, true);
  assert.equal(noteResult.id, "note-a");
  assert.equal(pageResult.ok, true);
  assert.equal(pageResult.kind, "page");
  assert.equal(pageResult.ref, "page:page-note-a");
  assert.deepEqual(pageResult.page, page);
  assert.equal(pageResult.evidence_status, "source_backed");
});

test("links returns local graph one-hop neighbors", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-links-"));
  fs.mkdirSync(path.join(stateDir, "graph"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "graph", "graph.json"),
    `${JSON.stringify({
      nodes: [
        { id: "note-a", type: "note", title: "Source" },
        { id: "note-b", type: "note", title: "Linked" },
        { id: "folder-1", type: "notebook", title: "Notebook" },
      ],
      edges: [
        { from: "note-a", to: "folder-1", type: "notebook_parent" },
        { from: "note-a", to: "note-b", type: "markdown_link" },
      ],
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("links must not call Joplin");
  };

  const result = JSON.parse(
    await run(["links", "note-a"], { WIKI_STATE_DIR: stateDir }, { fetchImpl }),
  );

  assert.deepEqual(result, {
    ok: true,
    id: "note-a",
    neighbors: [
      {
        id: "folder-1",
        type: "notebook",
        title: "Notebook",
        via: "notebook_parent",
        direction: "outbound",
      },
      {
        id: "note-b",
        type: "note",
        title: "Linked",
        via: "markdown_link",
        direction: "outbound",
      },
    ],
    edges: [
      { from: "note-a", to: "folder-1", type: "notebook_parent" },
      { from: "note-a", to: "note-b", type: "markdown_link" },
    ],
    evidence_status: "source_backed",
  });
});

test("links reports graph_missing when the graph artifact is absent", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-links-"));

  const result = JSON.parse(
    await run(["links", "note-a"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "GRAPH_NOT_FOUND");
  assert.equal(result.evidence_status, "graph_missing");
});

test("links returns not_found evidence status for an unknown note id", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-links-"));
  fs.mkdirSync(path.join(stateDir, "graph"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "graph", "graph.json"),
    `${JSON.stringify({
      nodes: [{ id: "note-a", type: "note", title: "Source" }],
      edges: [],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["links", "missing-note"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "NOTE_NOT_FOUND");
  assert.equal(result.evidence_status, "not_found");
});

test("links accepts explicit note and page refs", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-links-"));
  fs.mkdirSync(path.join(stateDir, "graph"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "graph", "graph.json"),
    `${JSON.stringify({
      nodes: [{ id: "note-a", type: "note", title: "Source" }],
      edges: [],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({
      pages: [
        {
          page_id: "page-note-a",
          title: "Local retrieval",
          aliases: [],
          tags: [],
          summary: "Hermes wiki local retrieval works",
          sections: [
            {
              heading: "Source note",
              text: "Hermes wiki local retrieval works",
              sources: ["note-a"],
            },
          ],
          links: [],
          sources: ["note-a"],
        },
      ],
    })}\n`,
  );

  const noteResult = JSON.parse(
    await run(["links", "note:note-a"], { WIKI_STATE_DIR: stateDir }),
  );
  const pageResult = JSON.parse(
    await run(["links", "page:page-note-a"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(noteResult.ok, true);
  assert.equal(noteResult.id, "note-a");
  assert.deepEqual(pageResult.neighbors, [
    {
      id: "note-a",
      type: "note",
      title: "Source",
      via: "page_source",
      direction: "outbound",
    },
  ]);
  assert.deepEqual(pageResult.edges, [
    { from: "page-note-a", to: "note-a", type: "page_source" },
  ]);
  assert.equal(pageResult.evidence_status, "source_backed");
});

test("audit writes deterministic Error Book entries and kind counts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-audit-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "graph"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [{ id: "note-a", title: "Source", plain_text: "Known source" }],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({
      pages: [
        {
          page_id: "page-note-a",
          title: "Local retrieval",
          aliases: [],
          tags: [],
          summary: "Unsupported summary",
          sections: [
            {
              heading: "Missing source",
              text: "Fact without source",
              sources: [],
            },
            {
              heading: "Unknown source",
              text: "Fact with unknown source",
              sources: ["missing-section-note"],
            },
          ],
          links: ["page-missing"],
          sources: ["missing-note"],
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "graph", "graph.json"),
    `${JSON.stringify({
      nodes: [{ id: "note-a", type: "note", title: "Source" }],
      edges: [{ from: "note-a", to: "missing-note", type: "markdown_link" }],
    })}\n`,
  );

  const result = JSON.parse(await run(["audit"], { WIKI_STATE_DIR: stateDir }));
  const errorBook = JSON.parse(
    fs.readFileSync(path.join(stateDir, "audit", "error-book.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "audited");
  assert.deepEqual(result.kind_counts, {
    dangling_link: 2,
    evidence_gap: 1,
    missing_source: 2,
  });
  assert.equal(result.total_errors, 5);
  assert.deepEqual(errorBook.entries.map((entry) => entry.kind), [
    "dangling_link",
    "dangling_link",
    "evidence_gap",
    "missing_source",
    "missing_source",
  ]);
  assert.deepEqual(Object.keys(errorBook.entries[0]), [
    "kind",
    "ref",
    "message",
    "artifact",
  ]);
});

test("automate once records review-gated maintenance pipeline artifacts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-automate-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 0, 0, tick++));
  const fetchCalls = [];
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    assert.match(pathname, /\/notes$/);
    assert.notEqual(options.method, "POST");
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-1",
            title: "Project Alpha",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source",
          },
          {
            id: "note-2",
            title: "Project Alpha followup",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha followup",
          },
        ],
        has_more: false,
      }),
    };
  };

  const result = JSON.parse(
    await run(
      ["automate", "once"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl, now },
    ),
  );
  const latest = JSON.parse(
    fs.readFileSync(path.join(stateDir, "automation", "latest.json"), "utf8"),
  );
  const runArtifact = JSON.parse(
    fs.readFileSync(path.join(stateDir, latest.path), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "automation_completed");
  assert.deepEqual(
    runArtifact.steps.map((step) => [step.name, step.status]),
    [
      ["sync", "completed"],
      ["compile", "completed"],
      ["draft candidates", "completed"],
      ["audit", "completed"],
    ],
  );
  assert.equal(runArtifact.exit_code, 0);
  assert.deepEqual(runArtifact.steps.flatMap((step) => step.artifacts), [
    "raw/notes-metadata.json",
    "compiled/notes.json",
    "compiled/pages.json",
    "candidates/consolidation-candidates.json",
    "audit/error-book.json",
  ]);
  assert.equal(latest.run_id, runArtifact.run_id);
  assert.equal(fetchCalls.some((call) => call.options.method === "POST"), false);
  assert.equal(fs.existsSync(path.join(stateDir, "review")), false);
});

test("automate once records failure evidence and stops unsafe later steps", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-automate-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 1, 0, tick++));
  const fetchImpl = async (url, options = {}) => {
    assert.notEqual(options.method, "POST");
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-1",
            title: "Broken source",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Body removed before compile",
          },
        ],
        has_more: false,
      }),
    };
  };
  const output = await run(
    ["automate", "once"],
    {
      WIKI_STATE_DIR: stateDir,
      WIKI_JOPLIN_TOKEN: "token-value",
    },
    {
      fetchImpl,
      now,
      afterAutomationStep: (step) => {
        if (step === "sync") {
          fs.rmSync(path.join(stateDir, "raw", "notes", "note-1.md"));
        }
      },
    },
  );

  const result = JSON.parse(output);
  const latest = JSON.parse(
    fs.readFileSync(path.join(stateDir, "automation", "latest.json"), "utf8"),
  );
  const runArtifact = JSON.parse(
    fs.readFileSync(path.join(stateDir, latest.path), "utf8"),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_RAW_BODY_MISSING");
  assert.equal(runArtifact.exit_code, 1);
  assert.deepEqual(
    runArtifact.steps.map((step) => [step.name, step.status]),
    [
      ["sync", "completed"],
      ["compile", "failed"],
    ],
  );
  assert.equal(runArtifact.steps[1].error.code, "WIKI_RAW_BODY_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "candidates")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
});

test("automate once returns busy without starting maintenance steps", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-automate-"));
  fs.writeFileSync(path.join(stateDir, "lock"), "wiki compile\n");
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error("busy automation must not call Joplin");
  };

  const result = JSON.parse(
    await run(
      ["automate", "once"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_BUSY");
  assert.equal(called, false);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "compiled")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "candidates")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "automation", "latest.json")), false);
});

test("automate once fails safely when state directory is unavailable", async () => {
  const stateFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "wiki-automate-")),
    "not-a-directory",
  );
  fs.writeFileSync(stateFile, "");

  const result = JSON.parse(
    await run(["automate", "once"], {
      WIKI_STATE_DIR: stateFile,
      WIKI_JOPLIN_TOKEN: "token-value",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_STATE_DIR_UNAVAILABLE");
});

test("periodic automate status reports missing state without creating artifacts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let called = false;
  const result = JSON.parse(
    await run(
      ["automate", "status"],
      { WIKI_STATE_DIR: stateDir },
      {
        fetchImpl: async () => {
          called = true;
          throw new Error("status must not start background work");
        },
      },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "AUTOMATION_STATUS_MISSING");
  assert.equal(called, false);
  assert.equal(fs.existsSync(path.join(stateDir, "automation")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "semantic")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "capture")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "review")), false);
});

test("periodic automate status reads latest run and summary artifacts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  const runArtifact = {
    ok: true,
    state: "automation_completed",
    run_id: "run-1",
    steps: [{ name: "sync", status: "completed" }],
  };
  const summary = {
    run_id: "run-1",
    created_at: "2026-06-19T00:00:00.000Z",
    candidates_seen: 0,
    drafts_created: 0,
    draft_ids: [],
    audit_total_errors: 0,
    notification: null,
    warnings: [],
    next_actions: ["review_candidates"],
  };
  fs.mkdirSync(path.join(stateDir, "automation", "runs"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "automation", "summaries"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "automation", "latest.json"),
    JSON.stringify({ run_id: "run-1", path: "automation/runs/run-1.json" }),
  );
  fs.writeFileSync(
    path.join(stateDir, "automation", "runs", "run-1.json"),
    JSON.stringify(runArtifact),
  );
  fs.writeFileSync(
    path.join(stateDir, "automation", "summaries", "run-1.json"),
    JSON.stringify(summary),
  );

  const result = JSON.parse(await run(["automate", "status"], { WIKI_STATE_DIR: stateDir }));

  assert.equal(result.ok, true);
  assert.equal(result.state, "automation_status");
  assert.equal(result.latest_run_id, "run-1");
  assert.equal(result.latest_run_path, "automation/runs/run-1.json");
  assert.deepEqual(result.latest_run, runArtifact);
  assert.deepEqual(result.summary, {
    ...summary,
    path: "automation/summaries/run-1.json",
  });
});

function periodicCandidateFetch(notes, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === "POST") {
      throw new Error("periodic automation must not write Joplin notes");
    }
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    assert.match(pathname, /\/notes$/);
    return {
      ok: true,
      json: async () => ({
        items: notes,
        has_more: false,
      }),
    };
  };
}

test("periodic automate once --draft-top creates bounded top-N LLM drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 2, 0, tick++));
  const calls = [];
  const result = JSON.parse(
    await run(
      ["automate", "once", "--draft-top", "2"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      {
        now,
        fetchImpl: periodicCandidateFetch([
          {
            id: "note-alpha-1",
            title: "Alpha Project part 1",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source one.",
          },
          {
            id: "note-alpha-2",
            title: "Alpha Project part 2",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source two.",
          },
          {
            id: "note-beta-1",
            title: "Beta Project part 1",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Beta source one.",
          },
          {
            id: "note-beta-2",
            title: "Beta Project part 2",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Beta source two.",
          },
          {
            id: "note-gamma-1",
            title: "Gamma Project part 1",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Gamma source one.",
          },
          {
            id: "note-gamma-2",
            title: "Gamma Project part 2",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Gamma source two.",
          },
        ], calls),
        llmProvider: async ({ refs }) => ({
          provider: "test-llm",
          model: "test-model",
          text: `Summary for ${refs.join(", ")}`,
        }),
      },
    ),
  );
  const summary = JSON.parse(
    fs.readFileSync(
      path.join(stateDir, "automation", "summaries", `${result.run_id}.json`),
      "utf8",
    ),
  );
  const draftFiles = fs.readdirSync(path.join(stateDir, "drafts"));
  const drafts = draftFiles.map((file) => (
    JSON.parse(fs.readFileSync(path.join(stateDir, "drafts", file), "utf8"))
  ));

  assert.equal(result.ok, true);
  assert.equal(summary.candidates_seen, 3);
  assert.equal(summary.drafts_created, 2);
  assert.equal(summary.draft_ids.length, 2);
  assert.equal(typeof summary.audit_total_errors, "number");
  assert.deepEqual(summary.warnings, []);
  assert.deepEqual(summary.next_actions, ["review_drafts", "approve_or_reject"]);
  assert.equal(drafts.length, 2);
  assert.equal(drafts.every((draft) => draft.kind === "consolidate"), true);
  assert.equal(drafts.every((draft) => draft.provenance.llm), true);
  assert.equal(calls.some((call) => call.options.method === "POST"), false);
  assert.equal(fs.existsSync(path.join(stateDir, "review", "consolidation-reviews.json")), false);
});

test("periodic automate once rejects invalid --draft-top before maintenance", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let called = false;
  const result = JSON.parse(
    await run(
      ["automate", "once", "--draft-top", "-1"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      {
        fetchImpl: async () => {
          called = true;
          throw new Error("invalid draft top must not start sync");
        },
      },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "AUTOMATION_DRAFT_TOP_INVALID");
  assert.equal(called, false);
  assert.equal(fs.existsSync(path.join(stateDir, "automation")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
});

test("periodic automate once without --draft-top writes zero-draft summary", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 3, 0, tick++));
  const result = JSON.parse(
    await run(
      ["automate", "once"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      {
        now,
        fetchImpl: periodicCandidateFetch([
          {
            id: "note-alpha-1",
            title: "Alpha Project part 1",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source one.",
          },
          {
            id: "note-alpha-2",
            title: "Alpha Project part 2",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source two.",
          },
        ]),
      },
    ),
  );
  const summary = JSON.parse(
    fs.readFileSync(
      path.join(stateDir, "automation", "summaries", `${result.run_id}.json`),
      "utf8",
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(summary.candidates_seen, 1);
  assert.equal(summary.drafts_created, 0);
  assert.deepEqual(summary.draft_ids, []);
  assert.equal(typeof summary.audit_total_errors, "number");
  assert.deepEqual(summary.warnings, []);
  assert.deepEqual(summary.next_actions, ["review_candidates"]);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("periodic automate once records LLM provider warning without failing maintenance", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 4, 0, tick++));
  const result = JSON.parse(
    await run(
      ["automate", "once", "--draft-top", "1"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      {
        now,
        fetchImpl: periodicCandidateFetch([
          {
            id: "note-alpha-1",
            title: "Alpha Project part 1",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source one.",
          },
          {
            id: "note-alpha-2",
            title: "Alpha Project part 2",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Alpha source two.",
          },
        ]),
        execFileSync: () => {
          throw new Error("ollama missing");
        },
      },
    ),
  );
  const summary = JSON.parse(
    fs.readFileSync(
      path.join(stateDir, "automation", "summaries", `${result.run_id}.json`),
      "utf8",
    ),
  );
  const runArtifact = JSON.parse(
    fs.readFileSync(path.join(stateDir, result.path), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(runArtifact.ok, true);
  assert.equal(runArtifact.state, "automation_completed");
  assert.deepEqual(summary.warnings, ["LLM_PROVIDER_MISSING"]);
  assert.equal(summary.drafts_created, 0);
  assert.deepEqual(summary.draft_ids, []);
  assert.deepEqual(summary.next_actions, ["configure_llm_provider", "review_candidates"]);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("periodic automate once --notify records notification failure without failing run", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-periodic-"));
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 5, 19, 5, 0, tick++));
  const discordMessages = [];
  const result = JSON.parse(
    await run(
      ["automate", "once", "--draft-top", "0", "--notify"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
        DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/test/webhook",
      },
      {
        now,
        fetchImpl: async (url, options = {}) => {
          const pathname = new URL(url).pathname;
          if (String(url).startsWith("https://discord.com/api/webhooks/")) {
            discordMessages.push(JSON.parse(options.body).content);
            return { ok: false, json: async () => ({}) };
          }
          if (options.method === "POST") {
            throw new Error("periodic notification must not write Joplin notes");
          }
          if (pathname.endsWith("/folders")) {
            return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
          }
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: "note-alpha-1",
                  title: "Alpha Project part 1",
                  parent_id: "folder-1",
                  updated_time: 123,
                  body: "Sensitive raw body must stay out of notification.",
                },
                {
                  id: "note-alpha-2",
                  title: "Alpha Project part 2",
                  parent_id: "folder-1",
                  updated_time: 123,
                  body: "Prompt-sized source body must stay local.",
                },
              ],
              has_more: false,
            }),
          };
        },
      },
    ),
  );
  const summary = JSON.parse(
    fs.readFileSync(
      path.join(stateDir, "automation", "summaries", `${result.run_id}.json`),
      "utf8",
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(summary.notification.ok, false);
  assert.equal(summary.notification.code, "DISCORD_NOTIFY_FAILED");
  assert.equal(discordMessages.length, 1);
  assert.doesNotMatch(discordMessages[0], /token-value/);
  assert.doesNotMatch(discordMessages[0], /Sensitive raw body/);
  assert.doesNotMatch(discordMessages[0], /Prompt-sized source body/);
});

test("draft creates reviewable filesystem drafts for telegram and discord", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-draft-"));
  const now = () => new Date("2026-06-18T03:00:00.000Z");

  const telegram = JSON.parse(
    await run(
      ["draft", "telegram", "Captured", "message"],
      { WIKI_STATE_DIR: stateDir },
      { now },
    ),
  );
  const discord = JSON.parse(
    await run(
      ["draft", "discord", "Server", "note"],
      { WIKI_STATE_DIR: stateDir },
      { now },
    ),
  );

  const telegramDraft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${telegram.draft_id}.json`), "utf8"),
  );
  assert.equal(telegram.ok, true);
  assert.equal(telegram.state, "drafted");
  assert.equal(telegram.kind, "telegram");
  assert.equal(discord.kind, "discord");
  assert.deepEqual(telegramDraft, {
    draft_id: telegram.draft_id,
    kind: "telegram",
    status: "pending_review",
    created_at: "2026-06-18T03:00:00.000Z",
    content: "Captured message",
    provenance: {
      source: "telegram",
      input: "cli",
      refs: [],
    },
    intended_target: {
      type: "joplin_inbox",
      notebook_id: "",
      conflict_behavior: "manual_review",
    },
  });
});

test("draft creates feedback and consolidation drafts without durable writes", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-draft-"));
  fs.mkdirSync(path.join(stateDir, "compiled", "pages"), { recursive: true });
  const notesJson = `${JSON.stringify({
    notes: [
      {
        id: "note-a",
        title: "Durable note",
        parent_id: "folder-1",
        updated_time: 123,
        body_hash: "hash-a",
        plain_text: "Durable source excerpt from a local compiled note.",
      },
    ],
  })}\n`;
  const pagesJson = `${JSON.stringify({
    pages: [
      {
        page_id: "page-topic",
        title: "Topic page",
        summary: "Compiled page summary.",
        sections: [],
        links: [],
        sources: ["note-a"],
      },
    ],
  })}\n`;
  fs.writeFileSync(path.join(stateDir, "compiled", "notes.json"), notesJson);
  fs.writeFileSync(path.join(stateDir, "compiled", "pages.json"), pagesJson);
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages", "page-topic.json"),
    pagesJson,
  );
  const now = () => new Date("2026-06-18T03:10:00.000Z");
  const fetchImpl = async () => {
    throw new Error("draft consolidate must not call Joplin");
  };

  const feedback = JSON.parse(
    await run(
      ["draft", "feedback", "--ref", "note:note-a", "Needs correction"],
      { WIKI_STATE_DIR: stateDir },
      { now },
    ),
  );
  const consolidate = JSON.parse(
    await run(
      [
        "draft",
        "consolidate",
        "--ref",
        "note:note-a",
        "--ref",
        "page:page-topic",
        "Durable summary",
      ],
      { WIKI_STATE_DIR: stateDir },
      { now, fetchImpl },
    ),
  );

  const feedbackDraft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${feedback.draft_id}.json`), "utf8"),
  );
  const consolidateDraft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${consolidate.draft_id}.json`), "utf8"),
  );
  assert.equal(feedback.ok, true);
  assert.equal(consolidate.ok, true);
  assert.equal(consolidate.state, "drafted");
  assert.equal(consolidate.kind, "consolidate");
  assert.equal(feedbackDraft.kind, "feedback");
  assert.deepEqual(feedbackDraft.provenance.refs, ["note:note-a"]);
  assert.equal(consolidateDraft.kind, "consolidate");
  assert.equal(consolidateDraft.status, "pending_review");
  assert.match(consolidateDraft.content, /Durable summary/);
  assert.match(consolidateDraft.content, /note:note-a/);
  assert.match(consolidateDraft.content, /Durable source excerpt/);
  assert.match(consolidateDraft.content, /page:page-topic/);
  assert.match(consolidateDraft.content, /Compiled page summary/);
  assert.deepEqual(consolidateDraft.provenance.refs, [
    "note:note-a",
    "page:page-topic",
  ]);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
  assert.equal(fs.readFileSync(path.join(stateDir, "compiled", "notes.json"), "utf8"), notesJson);
  assert.equal(fs.readFileSync(path.join(stateDir, "compiled", "pages.json"), "utf8"), pagesJson);
  assert.equal(fs.existsSync(path.join(stateDir, "graph")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});

test("draft consolidate builds content from compiled note sources", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-draft-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Keyboard DIY",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-a",
          plain_text:
            "PBT keycaps resist shine. ABS keycaps become glossy after long use.",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["draft", "consolidate", "--ref", "note:note-a", "Keycap material note"],
      { WIKI_STATE_DIR: stateDir },
      { now: () => new Date("2026-06-18T03:20:00.000Z") },
    ),
  );
  const draft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${result.draft_id}.json`), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.match(draft.content, /Keycap material note/);
  assert.match(draft.content, /note:note-a/);
  assert.match(draft.content, /Keyboard DIY/);
  assert.match(draft.content, /PBT keycaps resist shine/);
  assert.ok(draft.content.length > "Keycap material note".length);
  assert.deepEqual(draft.provenance.refs, ["note:note-a"]);
});

test("draft consolidate rejects missing compiled sources before writing drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-draft-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "compiled", "notes.json"), `${JSON.stringify({ notes: [] })}\n`);

  const result = JSON.parse(
    await run(
      ["draft", "consolidate", "--ref", "note:missing-note", "Durable summary"],
      { WIKI_STATE_DIR: stateDir },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_SOURCE_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("draft consolidate rejects unsafe refs before writing drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-draft-"));

  const result = JSON.parse(
    await run(
      ["draft", "consolidate", "--ref", "note:../secret", "Durable summary"],
      { WIKI_STATE_DIR: stateDir },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_REF_UNSAFE");
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "secret.json")), false);
});

test("llm consolidation creates source-backed review drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-llm-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Project memory",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-a",
          plain_text: "Hermes Wiki uses review gates before Joplin writeback.",
        },
      ],
    })}\n`,
  );
  const llmProvider = async ({ prompt, refs }) => {
    assert.match(prompt, /source-backed summary/i);
    assert.deepEqual(refs, ["note:note-a"]);
    return {
      provider: "test",
      model: "local-test",
      text: [
        "Summary: Hermes Wiki keeps writeback review-gated.",
        "Recommendations: Merge related memory notes only after review.",
        "Open questions: Confirm target notebook.",
      ].join("\n"),
    };
  };

  const result = JSON.parse(
    await run(
      [
        "draft",
        "llm-consolidate",
        "--ref",
        "note:note-a",
        "Summarize review gate",
      ],
      { WIKI_STATE_DIR: stateDir },
      {
        llmProvider,
        now: () => new Date("2026-06-19T02:00:00.000Z"),
      },
    ),
  );
  const draft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${result.draft_id}.json`), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "drafted");
  assert.equal(draft.kind, "consolidate");
  assert.equal(draft.status, "pending_review");
  assert.match(draft.content, /Summary: Hermes Wiki keeps writeback review-gated/);
  assert.match(draft.content, /Open questions: Confirm target notebook/);
  assert.deepEqual(draft.provenance.refs, ["note:note-a"]);
  assert.deepEqual(draft.provenance.llm, {
    provider: "test",
    model: "local-test",
    prompt_version: "llm-consolidation-v1",
    source_refs: ["note:note-a"],
    created_at: "2026-06-19T02:00:00.000Z",
    evidence_status: "source_backed",
  });
  assert.equal(fs.existsSync(path.join(stateDir, "review")), false);
});

test("llm consolidation fails closed when provider is missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-llm-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "joplin-123",
          title: "Provider example",
          plain_text: "Compiled source ref exists.",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      [
        "draft",
        "llm-consolidate",
        "--ref",
        "note:joplin-123",
        "Summarize source",
      ],
      { WIKI_STATE_DIR: stateDir },
      {
        execFileSync: () => {
          throw Object.assign(new Error("missing ollama"), { code: "ENOENT" });
        },
      },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "LLM_PROVIDER_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("llm consolidation fails closed when source refs are missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-llm-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "compiled", "notes.json"), `${JSON.stringify({ notes: [] })}\n`);
  const llmProvider = async () => {
    throw new Error("missing sources must not invoke provider");
  };

  const result = JSON.parse(
    await run(
      ["draft", "llm-consolidate", "--ref", "note:missing-note", "Summarize source"],
      { WIKI_STATE_DIR: stateDir },
      { llmProvider },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_SOURCE_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("semantic build creates rebuildable source-ref index", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-semantic-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({
      pages: [
        {
          page_id: "page-memory",
          title: "Project memory",
          summary: "Review-gated writeback keeps Joplin authoritative.",
          sections: [
            {
              heading: "Writeback",
              text: "Approve-only writeback preserves Joplin as source of truth.",
              sources: ["note-a"],
            },
          ],
          links: [],
          sources: ["note-a"],
        },
      ],
    })}\n`,
  );
  const embeddingProvider = async ({ text }) => ({
    model: "test-embedding",
    dimensions: 3,
    vector: [text.length, 1, 0],
  });

  const result = JSON.parse(
    await run(
      ["semantic", "build"],
      { WIKI_STATE_DIR: stateDir },
      {
        embeddingProvider,
        now: () => new Date("2026-06-19T03:00:00.000Z"),
      },
    ),
  );
  const index = JSON.parse(
    fs.readFileSync(path.join(stateDir, "semantic", "index.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "semantic_index_built");
  assert.equal(index.generated_at, "2026-06-19T03:00:00.000Z");
  assert.equal(index.chunks.length, 1);
  assert.deepEqual(Object.keys(index.chunks[0]), [
    "chunk_id",
    "page_id",
    "source_refs",
    "snippet",
    "content_hash",
    "embedding",
    "generated_at",
  ]);
  assert.equal(index.chunks[0].page_id, "page-memory");
  assert.deepEqual(index.chunks[0].source_refs, ["note-a"]);
  assert.equal(index.chunks[0].embedding.model, "test-embedding");
  assert.equal(index.chunks[0].embedding.dimensions, 3);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("semantic query returns scored source refs and snippets", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-semantic-"));
  fs.mkdirSync(path.join(stateDir, "semantic"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "semantic", "index.json"),
    `${JSON.stringify({
      generated_at: "2026-06-19T03:00:00.000Z",
      source_hash: "hash",
      chunks: [
        {
          chunk_id: "chunk-memory",
          page_id: "page-memory",
          source_refs: ["note-a"],
          snippet: "Approve-only writeback preserves project memory.",
          content_hash: "hash-a",
          embedding: { model: "test-embedding", dimensions: 3 },
          generated_at: "2026-06-19T03:00:00.000Z",
        },
        {
          chunk_id: "chunk-garden",
          page_id: "page-garden",
          source_refs: ["note-b"],
          snippet: "Garden watering log.",
          content_hash: "hash-b",
          embedding: { model: "test-embedding", dimensions: 3 },
          generated_at: "2026-06-19T03:00:00.000Z",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["semantic", "query", "project memory writeback"], {
      WIKI_STATE_DIR: stateDir,
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "semantic_refs");
  assert.deepEqual(result.results.map((item) => item.page_id), [
    "page-memory",
    "page-garden",
  ]);
  assert.deepEqual(result.results[0].source_refs, ["note-a"]);
  assert.match(result.results[0].snippet, /Approve-only writeback/);
  assert.equal(result.results[0].authoritative, false);
});

test("semantic query reports missing index without blocking keyword query", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-semantic-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Project memory",
          plain_text: "Project memory writeback remains review gated.",
        },
      ],
    })}\n`,
  );

  const semantic = JSON.parse(
    await run(["semantic", "query", "project memory writeback"], {
      WIKI_STATE_DIR: stateDir,
    }),
  );
  const keyword = JSON.parse(
    await run(["query", "project memory writeback"], {
      WIKI_STATE_DIR: stateDir,
    }),
  );

  assert.equal(semantic.ok, false);
  assert.equal(semantic.code, "SEMANTIC_INDEX_MISSING");
  assert.equal(keyword.ok, true);
  assert.equal(keyword.results[0].id, "note-a");
});

test("semantic build fails clearly when embedding provider is missing", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-semantic-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({
      pages: [
        {
          page_id: "page-memory",
          title: "Project memory",
          summary: "Review-gated writeback.",
          sections: [],
          sources: ["note-a"],
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["semantic", "build"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "EMBEDDING_PROVIDER_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "semantic", "index.json")), false);
});

test("capture ingestion creates allowlisted redacted filesystem drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-capture-"));
  const inputPath = path.join(stateDir, "telegram-events.json");
  fs.writeFileSync(
    inputPath,
    `${JSON.stringify({
      events: [
        {
          source_id: "chat-allowed",
          message_id: "msg-1",
          author_handle: "@alice",
          timestamp: "2026-06-19T04:00:00.000Z",
          text: "Remember token sk-test-123 and email me@example.com for project memory.",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["capture", "telegram", "--input", inputPath],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_CAPTURE_TELEGRAM_ALLOWLIST: "chat-allowed",
      },
      { now: () => new Date("2026-06-19T04:01:00.000Z") },
    ),
  );
  const draft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${result.drafts[0].draft_id}.json`), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "capture_ingested");
  assert.equal(result.drafts.length, 1);
  assert.equal(draft.kind, "telegram");
  assert.equal(draft.provenance.source, "telegram");
  assert.equal(draft.provenance.source_id, "chat-allowed");
  assert.equal(draft.provenance.message_id, "msg-1");
  assert.equal(draft.provenance.timestamp, "2026-06-19T04:00:00.000Z");
  assert.match(draft.provenance.author_handle_hash, /^[a-f0-9]{64}$/);
  assert.equal(draft.provenance.dedupe_key, "telegram:chat-allowed:msg-1");
  assert.deepEqual(draft.provenance.redaction_warnings, ["token", "email"]);
  assert.doesNotMatch(draft.content, /sk-test-123|me@example.com/);
  assert.match(draft.content, /\[REDACTED_TOKEN\]/);
  assert.match(draft.content, /\[REDACTED_EMAIL\]/);
  assert.equal(fs.existsSync(path.join(stateDir, "review")), false);
});

test("capture ingestion records disallowed and duplicate rejection evidence", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-capture-"));
  const inputPath = path.join(stateDir, "telegram-events.json");
  fs.writeFileSync(
    inputPath,
    `${JSON.stringify({
      events: [
        {
          source_id: "chat-unknown",
          message_id: "msg-1",
          author_handle: "@alice",
          timestamp: "2026-06-19T04:00:00.000Z",
          text: "Disallowed source",
        },
        {
          source_id: "chat-allowed",
          message_id: "msg-2",
          author_handle: "@alice",
          timestamp: "2026-06-19T04:01:00.000Z",
          text: "First accepted",
        },
        {
          source_id: "chat-allowed",
          message_id: "msg-2",
          author_handle: "@alice",
          timestamp: "2026-06-19T04:01:30.000Z",
          text: "Duplicate rejected",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["capture", "telegram", "--input", inputPath],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_CAPTURE_TELEGRAM_ALLOWLIST: "chat-allowed",
      },
      { now: () => new Date("2026-06-19T04:02:00.000Z") },
    ),
  );
  const evidence = JSON.parse(
    fs.readFileSync(path.join(stateDir, "capture", "runs", `${result.run_id}.json`), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 2);
  assert.equal(fs.readdirSync(path.join(stateDir, "drafts")).length, 1);
  assert.deepEqual(evidence.rejections.map((item) => item.reason), [
    "CAPTURE_SOURCE_NOT_ALLOWED",
    "CAPTURE_DUPLICATE",
  ]);
  assert.deepEqual(evidence.rejections.map((item) => item.dedupe_key), [
    "telegram:chat-unknown:msg-1",
    "telegram:chat-allowed:msg-2",
  ]);
});

test("capture ingestion applies rate limit evidence", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-capture-"));
  const inputPath = path.join(stateDir, "discord-events.json");
  fs.writeFileSync(
    inputPath,
    `${JSON.stringify({
      events: [
        {
          source_id: "channel-1",
          message_id: "msg-1",
          author_handle: "alice",
          timestamp: "2026-06-19T04:00:00.000Z",
          text: "First accepted",
        },
        {
          source_id: "channel-1",
          message_id: "msg-2",
          author_handle: "alice",
          timestamp: "2026-06-19T04:01:00.000Z",
          text: "Rate limited",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["capture", "discord", "--input", inputPath],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_CAPTURE_DISCORD_ALLOWLIST: "channel-1",
        WIKI_CAPTURE_RATE_LIMIT: "1",
      },
      { now: () => new Date("2026-06-19T04:03:00.000Z") },
    ),
  );

  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.rejections[0].reason, "CAPTURE_RATE_LIMITED");
  assert.equal(fs.readdirSync(path.join(stateDir, "drafts")).length, 1);
});

test("draft candidates returns bounded candidates from compiled notes", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-candidates-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "a",
          title: "Keyboard DIY part 1",
          parent_id: "folder-1",
          updated_time: 100,
          body_hash: "hash-a",
          plain_text: "Switch notes.",
        },
        {
          id: "b",
          title: "Keyboard DIY part 2",
          parent_id: "folder-1",
          updated_time: 101,
          body_hash: "hash-b",
          plain_text: "Keycap notes.",
        },
        {
          id: "c",
          title: "Garden log",
          parent_id: "folder-2",
          updated_time: 102,
          body_hash: "hash-c",
          plain_text: "Unrelated.",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(
    await run(["draft", "candidates", "--limit", "1"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "candidates_found");
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].refs, ["note:a", "note:b"]);
  assert.ok(result.candidates[0].reasons.includes("title_prefix"));
  assert.ok(result.candidates[0].reasons.includes("same_parent"));
  assert.equal(typeof result.candidates[0].score, "number");
  assert.equal(result.candidates[0].priority, "medium");
  assert.equal(result.candidates[0].goal, "Consolidate Keyboard DIY notes");
  assert.deepEqual(result.candidates[0].proposed_target, {
    type: "joplin_inbox",
    notebook_id: "folder-1",
  });
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("draft candidates fails without compiled artifacts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-candidates-"));

  const result = JSON.parse(
    await run(["draft", "candidates"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIKI_COMPILED_INDEX_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "candidates")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("draft candidate creates a review-gated consolidation draft", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-candidate-draft-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "candidates"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "a",
          title: "Keyboard DIY part 1",
          parent_id: "folder-1",
          updated_time: 100,
          body_hash: "hash-a",
          plain_text: "Switch notes.",
        },
        {
          id: "b",
          title: "Keyboard DIY part 2",
          parent_id: "folder-1",
          updated_time: 101,
          body_hash: "hash-b",
          plain_text: "Keycap notes.",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "candidates", "consolidation-candidates.json"),
    `${JSON.stringify({
      candidates: [
        {
          candidate_id: "candidate-a",
          refs: ["note:a", "note:b"],
          reason: "related_title",
          priority: "medium",
          goal: "Consolidate Keyboard DIY notes",
          status: "pending_review",
        },
      ],
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("draft candidate must not call Joplin");
  };

  const result = JSON.parse(
    await run(
      ["draft", "candidate", "candidate-a"],
      { WIKI_STATE_DIR: stateDir },
      { fetchImpl, now: () => new Date("2026-06-18T03:30:00.000Z") },
    ),
  );
  const draft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${result.draft_id}.json`), "utf8"),
  );
  const reviewState = JSON.parse(
    fs.readFileSync(path.join(stateDir, "review", "consolidation-reviews.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.state, "drafted");
  assert.equal(draft.kind, "consolidate");
  assert.equal(draft.status, "pending_review");
  assert.deepEqual(draft.provenance.refs, ["note:a", "note:b"]);
  assert.equal(draft.provenance.candidate_id, "candidate-a");
  assert.match(draft.content, /Consolidate Keyboard DIY notes/);
  assert.match(draft.content, /Switch notes/);
  assert.match(draft.content, /Keycap notes/);
  assert.deepEqual(reviewState.reviews, [
    {
      candidate_id: "candidate-a",
      draft_id: result.draft_id,
      decision: "pending",
      joplin_note_id: "",
      decided_at: "2026-06-18T03:30:00.000Z",
      rollback: {},
    },
  ]);
});

test("draft candidate rejects unknown candidates before writing drafts", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-candidate-draft-"));
  fs.mkdirSync(path.join(stateDir, "candidates"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "candidates", "consolidation-candidates.json"),
    `${JSON.stringify({ candidates: [] })}\n`,
  );

  const result = JSON.parse(
    await run(["draft", "candidate", "missing-candidate"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_CANDIDATE_MISSING");
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
});

test("candidate draft approval and rejection write local review evidence", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-review-"));
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-approved.json"),
    `${JSON.stringify({
      draft_id: "draft-approved",
      kind: "consolidate",
      status: "pending_review",
      created_at: "2026-06-18T03:00:00.000Z",
      content: "# Approved candidate",
      provenance: {
        source: "consolidate",
        input: "cli",
        refs: ["note:a"],
        candidate_id: "candidate-a",
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "folder-1",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-rejected.json"),
    `${JSON.stringify({
      draft_id: "draft-rejected",
      kind: "consolidate",
      status: "pending_review",
      created_at: "2026-06-18T03:05:00.000Z",
      content: "# Rejected candidate",
      provenance: {
        source: "consolidate",
        input: "cli",
        refs: ["note:b"],
        candidate_id: "candidate-b",
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "folder-1",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ id: "joplin-note-a" }),
  });

  const approved = JSON.parse(
    await run(
      ["approve", "draft-approved"],
      { WIKI_STATE_DIR: stateDir, WIKI_JOPLIN_TOKEN: "token-value" },
      { fetchImpl, now: () => new Date("2026-06-18T03:40:00.000Z") },
    ),
  );
  const rejected = JSON.parse(
    await run(
      ["draft", "reject", "draft-rejected"],
      { WIKI_STATE_DIR: stateDir },
      { now: () => new Date("2026-06-18T03:41:00.000Z") },
    ),
  );
  const reviewState = JSON.parse(
    fs.readFileSync(path.join(stateDir, "review", "consolidation-reviews.json"), "utf8"),
  );

  assert.equal(approved.ok, true);
  assert.equal(rejected.ok, true);
  assert.deepEqual(reviewState.reviews, [
    {
      candidate_id: "candidate-a",
      draft_id: "draft-approved",
      decision: "approved",
      joplin_note_id: "joplin-note-a",
      decided_at: "2026-06-18T03:40:00.000Z",
      rollback: { joplin_note_id: "joplin-note-a" },
    },
    {
      candidate_id: "candidate-b",
      draft_id: "draft-rejected",
      decision: "rejected",
      joplin_note_id: "",
      decided_at: "2026-06-18T03:41:00.000Z",
      rollback: {},
    },
  ]);
});

test("audit reports consolidation draft governance errors", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-audit-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [{ id: "note-a", title: "Source", plain_text: "Known source" }],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-consolidate.json"),
    `${JSON.stringify({
      draft_id: "draft-consolidate",
      kind: "consolidate",
      status: "pending_review",
      content: "Durable summary",
      provenance: {
        source: "consolidate",
        input: "cli",
        refs: ["note:missing-note", "page:page-missing"],
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );

  const result = JSON.parse(await run(["audit"], { WIKI_STATE_DIR: stateDir }));
  const errorBook = JSON.parse(
    fs.readFileSync(path.join(stateDir, "audit", "error-book.json"), "utf8"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.kind_counts.draft_target_missing, 1);
  assert.equal(result.kind_counts.missing_source, 2);
  assert.ok(
    errorBook.entries.some((entry) => (
      entry.kind === "draft_target_missing" &&
      entry.ref === "draft-consolidate"
    )),
  );
  assert.ok(
    errorBook.entries.some((entry) => (
      entry.kind === "missing_source" &&
      entry.ref === "draft-consolidate:note:missing-note"
    )),
  );
  assert.ok(
    errorBook.entries.some((entry) => (
      entry.kind === "missing_source" &&
      entry.ref === "draft-consolidate:page:page-missing"
    )),
  );
});

test("audit reports local review governance statistics", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-audit-"));
  fs.mkdirSync(path.join(stateDir, "review"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "review", "consolidation-reviews.json"),
    `${JSON.stringify({
      reviews: [
        {
          candidate_id: "candidate-a",
          draft_id: "draft-a",
          decision: "pending",
          joplin_note_id: "",
          decided_at: "2026-06-18T03:30:00.000Z",
        },
        {
          candidate_id: "candidate-b",
          draft_id: "draft-b",
          decision: "approved",
          joplin_note_id: "joplin-note-b",
          decided_at: "2026-06-18T03:40:00.000Z",
        },
        {
          candidate_id: "candidate-c",
          draft_id: "draft-c",
          decision: "rejected",
          joplin_note_id: "",
          decided_at: "2026-06-18T03:41:00.000Z",
        },
      ],
    })}\n`,
  );

  const result = JSON.parse(await run(["audit"], { WIKI_STATE_DIR: stateDir }));

  assert.deepEqual(result.review_counts, {
    pending: 1,
    approved: 1,
    rejected: 1,
  });
});

test("approve gates Joplin writeback on complete draft metadata", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-approve-"));
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-ready.json"),
    `${JSON.stringify({
      draft_id: "draft-ready",
      kind: "telegram",
      status: "pending_review",
      content: "Approved long-term memory",
      provenance: {
        source: "telegram",
        input: "cli",
        refs: [],
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "inbox-folder",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return { ok: true, json: async () => ({ id: "joplin-note-1" }) };
  };

  const output = await run(
    ["approve", "draft-ready"],
    {
      WIKI_STATE_DIR: stateDir,
      WIKI_JOPLIN_TOKEN: "token-value",
    },
    { fetchImpl },
  );
  const result = JSON.parse(output);

  assert.equal(result.ok, true);
  assert.equal(result.state, "approved");
  assert.equal(result.joplin_note_id, "joplin-note-1");
  assert.equal(calls.length, 1);
  assert.match(new URL(calls[0].url).pathname, /\/notes$/);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    title: "Approved long-term memory",
    body: "Approved long-term memory",
    parent_id: "inbox-folder",
  });
  assert.doesNotMatch(output, /token-value/);
});

test("approve rejects incomplete drafts before Joplin writeback", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-approve-"));
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-incomplete.json"),
    `${JSON.stringify({
      draft_id: "draft-incomplete",
      kind: "telegram",
      content: "Missing target",
      provenance: {
        source: "telegram",
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );
  const fetchImpl = async () => {
    throw new Error("approve must not call Joplin for incomplete drafts");
  };

  const result = JSON.parse(
    await run(
      ["approve", "draft-incomplete"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_APPROVAL_INVALID");
});

test("approve preserves local draft when Joplin writeback fails", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-approve-"));
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  const draftPath = path.join(stateDir, "drafts", "draft-ready.json");
  fs.writeFileSync(
    draftPath,
    `${JSON.stringify({
      draft_id: "draft-ready",
      kind: "telegram",
      content: "Approved long-term memory",
      provenance: {
        source: "telegram",
      },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "inbox-folder",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );

  const result = JSON.parse(
    await run(
      ["approve", "draft-ready"],
      {
        WIKI_STATE_DIR: stateDir,
        WIKI_JOPLIN_TOKEN: "token-value",
      },
      { fetchImpl: async () => ({ ok: false }) },
    ),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "JOPLIN_WRITEBACK_FAILED");
  assert.equal(fs.existsSync(draftPath), true);
});

test("non-approve sedimentation commands never write to Joplin", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-writeback-"));
  const fetchCalls = [];
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    if (options.method === "POST") {
      throw new Error("non-approve commands must not write Joplin notes");
    }
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/folders")) {
      return { ok: true, json: async () => ({ items: [{ id: "folder-1" }] }) };
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "note-a",
            title: "Project Memory",
            parent_id: "folder-1",
            updated_time: 123,
            body: "Review-gated memory source.",
          },
        ],
        has_more: false,
      }),
    };
  };
  await run(
    ["automate", "once"],
    { WIKI_STATE_DIR: stateDir, WIKI_JOPLIN_TOKEN: "token-value" },
    { fetchImpl, now: () => new Date("2026-06-19T05:00:00.000Z") },
  );
  await run(
    ["draft", "llm-consolidate", "--ref", "note:note-a", "Summarize"],
    { WIKI_STATE_DIR: stateDir },
    {
      llmProvider: async () => ({
        provider: "test",
        model: "local-test",
        text: "Summary: review-gated.",
      }),
      now: () => new Date("2026-06-19T05:01:00.000Z"),
    },
  );
  await run(
    ["semantic", "build"],
    { WIKI_STATE_DIR: stateDir },
    {
      embeddingProvider: async ({ text }) => ({
        model: "test-embedding",
        dimensions: 1,
        vector: [text.length],
      }),
      now: () => new Date("2026-06-19T05:02:00.000Z"),
    },
  );
  const inputPath = path.join(stateDir, "capture-events.json");
  fs.writeFileSync(
    inputPath,
    `${JSON.stringify({
      events: [
        {
          source_id: "chat-allowed",
          message_id: "msg-1",
          author_handle: "@alice",
          timestamp: "2026-06-19T05:03:00.000Z",
          text: "Captured memory",
        },
      ],
    })}\n`,
  );
  await run(
    ["capture", "telegram", "--input", inputPath],
    {
      WIKI_STATE_DIR: stateDir,
      WIKI_CAPTURE_TELEGRAM_ALLOWLIST: "chat-allowed",
    },
    { now: () => new Date("2026-06-19T05:04:00.000Z") },
  );

  assert.equal(fetchCalls.some((call) => call.options.method === "POST"), false);
});

test("notify discord requires a message", async () => {
  const result = JSON.parse(
    await run(["notify", "discord"], {
      DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/id/token",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "DISCORD_NOTIFY_MESSAGE_MISSING");
});

test("notify discord fails safely when webhook is missing or invalid", async () => {
  const missing = JSON.parse(
    await run(["notify", "discord", "--message", "hello"], {}),
  );
  const invalid = JSON.parse(
    await run(
      ["notify", "discord", "--message", "hello"],
      { DISCORD_SYSTEM_WEBHOOK_URL: "https://example.com/hook" },
    ),
  );

  assert.equal(missing.ok, false);
  assert.equal(missing.code, "DISCORD_SYSTEM_WEBHOOK_URL_MISSING");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "DISCORD_SYSTEM_WEBHOOK_URL_INVALID");
});

test("notify discord posts a system message without leaking the webhook", async () => {
  const webhookUrl = "https://discord.com/api/webhooks/id/token-value";
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  };

  const output = await run(
    ["notify", "discord", "--message", "[Hermes Wiki] 測試"],
    { DISCORD_SYSTEM_WEBHOOK_URL: webhookUrl },
    { fetchImpl },
  );
  const result = JSON.parse(output);

  assert.equal(result.ok, true);
  assert.equal(result.state, "notified");
  assert.equal(result.target, "discord_system");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, webhookUrl);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    content: "[Hermes Wiki] 測試",
  });
  assert.doesNotMatch(output, /token-value/);
});

test("notify discord reports webhook failures safely", async () => {
  const output = await run(
    ["notify", "discord", "--message", "hello"],
    { DISCORD_SYSTEM_WEBHOOK_URL: "https://discord.com/api/webhooks/id/token-value" },
    { fetchImpl: async () => ({ ok: false }) },
  );
  const result = JSON.parse(output);

  assert.equal(result.ok, false);
  assert.equal(result.code, "DISCORD_NOTIFY_FAILED");
  assert.doesNotMatch(output, /token-value/);
});

test("foreground and capture commands do not create job files", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-foreground-"));
  for (const args of [
    ["query", "問題"],
    ["draft", "telegram", "capture"],
    ["approve", "draft-1"],
  ]) {
    await run(args, { WIKI_STATE_DIR: stateDir, WIKI_JOPLIN_TOKEN: "token-value" });
  }

  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});

test("foreground read and query do not trigger hidden background work", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-foreground-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Hermes memory",
          plain_text: "Hermes memory stays source backed.",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "note-a.md"), "Hermes memory stays source backed.");

  const queryResult = JSON.parse(
    await run(["query", "Hermes memory"], { WIKI_STATE_DIR: stateDir }),
  );
  const readResult = JSON.parse(
    await run(["read", "note-a"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(queryResult.ok, true);
  assert.equal(readResult.ok, true);
  for (const dirName of ["automation", "drafts", "semantic", "capture", "review", "audit"]) {
    assert.equal(fs.existsSync(path.join(stateDir, dirName)), false, dirName);
  }
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});

test("draft candidates emits stable multi-signal scored candidates", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-candidates-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "graph"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "a",
          title: "Keyboard DIY part 1",
          parent_id: "folder-1",
          updated_time: Date.parse("2026-06-18T01:00:00.000Z"),
          body_hash: "hash-a",
          plain_text: "Switch notes.",
        },
        {
          id: "b",
          title: "Keyboard DIY part 2",
          parent_id: "folder-1",
          updated_time: Date.parse("2026-06-18T02:00:00.000Z"),
          body_hash: "hash-b",
          plain_text: "Keycap notes.",
        },
        {
          id: "c",
          title: "Keyboard DIY part 3",
          parent_id: "folder-1",
          updated_time: Date.parse("2026-06-18T03:00:00.000Z"),
          body_hash: "hash-c",
          plain_text: "Case notes.",
        },
        {
          id: "d",
          title: "Garden log",
          parent_id: "folder-2",
          updated_time: Date.parse("2026-06-20T01:00:00.000Z"),
          body_hash: "hash-d",
          plain_text: "Unrelated.",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "compiled", "pages.json"),
    `${JSON.stringify({
      pages: [
        {
          page_id: "page-keyboard-diy",
          title: "Keyboard DIY",
          summary: "Keyboard DIY",
          sections: [],
          links: [],
          sources: ["a", "b"],
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "graph", "graph.json"),
    `${JSON.stringify({
      nodes: [
        { id: "a", type: "note", title: "Keyboard DIY part 1" },
        { id: "b", type: "note", title: "Keyboard DIY part 2" },
      ],
      edges: [{ from: "a", to: "b", type: "markdown_link" }],
    })}\n`,
  );

  const first = JSON.parse(
    await run(["draft", "candidates", "--limit", "2"], { WIKI_STATE_DIR: stateDir }),
  );
  const second = JSON.parse(
    await run(["draft", "candidates", "--limit", "2"], { WIKI_STATE_DIR: stateDir }),
  );
  const candidate = first.candidates[0];
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(stateDir, "candidates", "consolidation-candidates.json"),
      "utf8",
    ),
  );

  assert.equal(first.ok, true);
  assert.equal(first.candidates.length <= 2, true);
  assert.deepEqual(first.candidates.map((item) => item.candidate_id), second.candidates.map((item) => item.candidate_id));
  assert.deepEqual(candidate.refs, ["note:a", "note:b", "note:c"]);
  assert.ok(candidate.reasons.includes("title_prefix"));
  assert.ok(candidate.reasons.includes("same_parent"));
  assert.equal(typeof candidate.score, "number");
  assert.ok(candidate.score > 0);
  assert.ok(["high", "medium", "low"].includes(candidate.priority));
  assert.deepEqual(candidate.proposed_target, { type: "joplin_inbox", notebook_id: "folder-1" });
  assert.deepEqual(artifact.candidates.map((item) => item.candidate_id), first.candidates.map((item) => item.candidate_id));
});

test("compile groups related notes into source-backed readable pages", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-compile-"));
  fs.mkdirSync(path.join(stateDir, "raw", "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "raw", "notes-metadata.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "a",
          title: "Keyboard DIY part 1",
          parent_id: "folder-1",
          updated_time: 100,
          body_hash: "hash-a",
        },
        {
          id: "b",
          title: "Keyboard DIY part 2",
          parent_id: "folder-1",
          updated_time: 101,
          body_hash: "hash-b",
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "a.md"), "Switch notes.");
  fs.writeFileSync(path.join(stateDir, "raw", "notes", "b.md"), "Keycap notes.");

  const result = JSON.parse(await run(["compile"], { WIKI_STATE_DIR: stateDir }));
  const pages = JSON.parse(fs.readFileSync(path.join(stateDir, "compiled", "pages.json"), "utf8"));
  const page = pages.pages.find((item) => (
    item.sources.includes("a") && item.sources.includes("b")
  ));
  const readResult = JSON.parse(await run(["read", `page:${page.page_id}`], { WIKI_STATE_DIR: stateDir }));
  const linksResult = JSON.parse(await run(["links", `page:${page.page_id}`], { WIKI_STATE_DIR: stateDir }));

  assert.equal(result.ok, true);
  assert.ok(page);
  assert.match(`${page.summary} ${page.sections.map((section) => section.text).join(" ")}`, /Switch notes/);
  assert.match(`${page.summary} ${page.sections.map((section) => section.text).join(" ")}`, /Keycap notes/);
  assert.equal(page.sections.every((section) => section.sources.length > 0), true);
  assert.equal(readResult.evidence_status, "source_backed");
  assert.equal(linksResult.evidence_status, "source_backed");
  assert.deepEqual(linksResult.edges, [
    { from: page.page_id, to: "a", type: "page_source" },
    { from: page.page_id, to: "b", type: "page_source" },
  ]);
  assert.equal(fs.existsSync(path.join(stateDir, "drafts")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "candidates")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
});

test("consolidation drafts accept explicit safe target notebooks", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-target-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({
      notes: [
        {
          id: "note-a",
          title: "Keyboard DIY",
          parent_id: "folder-1",
          updated_time: 123,
          body_hash: "hash-a",
          plain_text: "PBT keycaps resist shine.",
        },
      ],
    })}\n`,
  );

  const drafted = JSON.parse(
    await run(
      [
        "draft",
        "consolidate",
        "--target-notebook",
        "folder-1",
        "--ref",
        "note:note-a",
        "Keycap material note",
      ],
      { WIKI_STATE_DIR: stateDir },
      { fetchImpl: async () => { throw new Error("draft must not call Joplin"); } },
    ),
  );
  const draft = JSON.parse(
    fs.readFileSync(path.join(stateDir, "drafts", `${drafted.draft_id}.json`), "utf8"),
  );
  const unsafe = JSON.parse(
    await run(
      [
        "draft",
        "consolidate",
        "--target-notebook",
        "../secret",
        "--ref",
        "note:note-a",
        "Summary",
      ],
      { WIKI_STATE_DIR: stateDir },
    ),
  );

  assert.equal(drafted.ok, true);
  assert.equal(draft.intended_target.notebook_id, "folder-1");
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, "DRAFT_TARGET_UNSAFE");
  assert.equal(fs.existsSync(path.join(stateDir, "secret.json")), false);
});

test("audit reports candidate and target governance errors", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-audit-"));
  fs.mkdirSync(path.join(stateDir, "compiled"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "candidates"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    `${JSON.stringify({ notes: [{ id: "note-a", title: "Source", plain_text: "Known" }] })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "candidates", "consolidation-candidates.json"),
    `${JSON.stringify({
      candidates: [
        {
          candidate_id: "candidate-a",
          refs: ["note:missing-note"],
          reasons: ["title_prefix"],
          score: 1,
          priority: "low",
          goal: "Consolidate missing notes",
          status: "pending_review",
          proposed_target: { type: "joplin_inbox", notebook_id: "" },
        },
      ],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(stateDir, "drafts", "draft-consolidate.json"),
    `${JSON.stringify({
      draft_id: "draft-consolidate",
      kind: "consolidate",
      status: "pending_review",
      content: "Draft content",
      provenance: { source: "consolidate", input: "cli", refs: ["note:note-a"] },
      intended_target: {
        type: "joplin_inbox",
        notebook_id: "",
        conflict_behavior: "manual_review",
      },
    })}\n`,
  );

  const result = JSON.parse(await run(["audit"], { WIKI_STATE_DIR: stateDir }));
  const errorBook = JSON.parse(fs.readFileSync(path.join(stateDir, "audit", "error-book.json"), "utf8"));

  assert.equal(result.ok, true);
  assert.equal(result.kind_counts.missing_source, 1);
  assert.equal(result.kind_counts.candidate_too_small, 1);
  assert.equal(result.kind_counts.draft_target_missing, 1);
  assert.ok(errorBook.entries.some((entry) => (
    entry.kind === "missing_source" &&
    entry.ref === "candidate-a:note:missing-note"
  )));
  assert.ok(errorBook.entries.some((entry) => (
    entry.kind === "candidate_too_small" &&
    entry.ref === "candidate-a"
  )));
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});
