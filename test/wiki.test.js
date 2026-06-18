import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { defaultStateDir, parseArgs, run } from "../src/wiki.js";

test("parses known commands", () => {
  assert.deepEqual(parseArgs(["compile"]), { command: "compile", rest: [] });
  assert.deepEqual(parseArgs(["query", "問題"]), { command: "query", rest: ["問題"] });
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

test("future commands return stable not implemented json", async () => {
  for (const args of [
    ["compile"],
    ["query", "問題"],
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
