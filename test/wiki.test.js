import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { defaultStateDir, parseArgs, run } from "../src/wiki.js";

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
    await run(["query", "local", "retrieval"], { WIKI_STATE_DIR: stateDir }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.results.map((note) => note.id), ["a", "b"]);
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
  assert.equal(consolidateDraft.content, "Durable summary");
  assert.deepEqual(consolidateDraft.provenance.refs, [
    "note:note-a",
    "page:page-topic",
  ]);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "compiled")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "graph")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "audit")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
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
