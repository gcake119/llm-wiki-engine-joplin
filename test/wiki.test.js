import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { defaultStateDir, parseArgs, run } from "../src/wiki.js";

test("parses known commands", () => {
  assert.deepEqual(parseArgs(["compile"]), { command: "compile", rest: [] });
  assert.deepEqual(parseArgs(["query", "問題"]), { command: "query", rest: ["問題"] });
  assert.deepEqual(parseArgs(["notify", "discord"]), {
    command: "notify",
    rest: ["discord"],
  });
});

test("falls back to help for unknown commands", () => {
  assert.deepEqual(parseArgs(["wat"]), { command: "help", rest: [] });
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
  const secondResult = JSON.parse(
    await run(["compile"], { WIKI_STATE_DIR: stateDir }, deps),
  );
  const secondCompiled = fs.readFileSync(
    path.join(stateDir, "compiled", "notes.json"),
    "utf8",
  );

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.last_job, "compile");
  assert.equal(firstResult.notes_compiled, 1);
  assert.equal(firstCompiled, secondCompiled);
  assert.equal(secondResult.ok, true);

  const compiled = JSON.parse(firstCompiled);
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
  const statusJson = JSON.parse(
    fs.readFileSync(path.join(stateDir, "status.json"), "utf8"),
  );
  assert.equal(statusJson.last_job, "compile");
  assert.equal(statusJson.notes_compiled, 1);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
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
  assert.equal(result.results.length, 1);
  assert.deepEqual(Object.keys(result.results[0]), [
    "id",
    "title",
    "snippet",
    "score",
  ]);
  assert.equal(result.results[0].id, "note-1");
  assert.equal(result.results[0].title, "Durable memory");
  assert.match(result.results[0].snippet, /durable wiki/);
  assert.ok(result.results[0].score > 0);
  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "raw")), false);
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
  assert.equal(result.message, "資料不足");
  assert.deepEqual(result.results, []);
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

test("future commands return stable not implemented json", async () => {
  for (const args of [
    ["draft", "telegram"],
    ["draft", "discord"],
    ["approve", "draft-1"],
  ]) {
    const result = JSON.parse(await run(args));
    assert.equal(result.ok, false);
    assert.equal(result.state, "not_implemented");
    assert.match(result.message, /^wiki (compile|query|draft|approve) /);
  }
});

test("foreground and capture commands do not create job files", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-foreground-"));
  for (const args of [
    ["query", "問題"],
    ["draft", "telegram"],
    ["approve", "draft-1"],
  ]) {
    await run(args, { WIKI_STATE_DIR: stateDir, WIKI_JOPLIN_TOKEN: "token-value" });
  }

  assert.equal(fs.existsSync(path.join(stateDir, "lock")), false);
  assert.equal(fs.existsSync(path.join(stateDir, "status.json")), false);
});
