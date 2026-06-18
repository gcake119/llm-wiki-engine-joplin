#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";

const COMMANDS = new Set([
  "status",
  "sync",
  "compile",
  "query",
  "notify",
  "draft",
  "approve",
]);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.has(command)) {
    return { command: "help", rest: [] };
  }
  return { command, rest };
}

export function defaultStateDir(env = process.env) {
  return env.WIKI_STATE_DIR || "/Users/hermes/knowledge";
}

export function joplinConfig(env = process.env) {
  return {
    apiUrl: env.WIKI_JOPLIN_API_URL || env.JOPLIN_API_URL || "http://127.0.0.1:41184",
    token: env.WIKI_JOPLIN_TOKEN || env.JOPLIN_TOKEN || "",
  };
}

function discordSystemWebhookUrl(env = process.env) {
  return env.DISCORD_SYSTEM_WEBHOOK_URL || "";
}

export function status(stateDir = defaultStateDir()) {
  const statusPath = path.join(stateDir, "status.json");
  if (!fs.existsSync(statusPath)) {
    return {
      ok: true,
      state: "new",
      message: "尚未建立 wiki 狀態。先執行 wiki sync 或 wiki compile。",
    };
  }
  return JSON.parse(fs.readFileSync(statusPath, "utf8"));
}

function safeError(code, message) {
  return { ok: false, code, message };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeNoteId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw Object.assign(new Error("Joplin note id is not safe for local cache."), {
      code: "JOPLIN_NOTE_ID_UNSAFE",
    });
  }
  return id;
}

function withToken(apiUrl, pathname, token, params = {}) {
  const url = new URL(pathname, apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  url.searchParams.set("token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url);
  } catch {
    throw Object.assign(new Error("Joplin Data API is unavailable."), {
      code: "JOPLIN_API_UNAVAILABLE",
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error("Joplin Data API returned an error."), {
      code: "JOPLIN_API_UNAVAILABLE",
    });
  }
  return response.json();
}

function noteMetadata(note) {
  const body = note.body || "";
  return {
    id: safeNoteId(note.id),
    title: note.title || "",
    parent_id: note.parent_id || "",
    updated_time: note.updated_time || 0,
    body_hash: crypto.createHash("sha256").update(body).digest("hex"),
  };
}

function writeRawNoteBodies(stateDir, notes) {
  const notesDir = path.join(stateDir, "raw", "notes");
  fs.mkdirSync(notesDir, { recursive: true });
  for (const note of notes) {
    fs.writeFileSync(path.join(notesDir, `${safeNoteId(note.id)}.md`), note.body || "");
  }
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(question) {
  return question.toLowerCase().split(/\s+/).filter(Boolean);
}

function noteScore(note, terms) {
  const title = (note.title || "").toLowerCase();
  const text = (note.plain_text || "").toLowerCase();
  return terms.reduce((score, term) => {
    return score + (title.includes(term) ? 2 : 0) + (text.includes(term) ? 1 : 0);
  }, 0);
}

function snippet(note, terms) {
  const text = note.plain_text || "";
  const lower = text.toLowerCase();
  const firstMatch = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] || 0;
  return text.slice(Math.max(0, firstMatch - 40), firstMatch + 120).trim();
}

export async function sync({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const stateDir = defaultStateDir(env);
  const lockPath = path.join(stateDir, "lock");
  const statusPath = path.join(stateDir, "status.json");
  const rawCachePath = path.join(stateDir, "raw", "notes-metadata.json");

  try {
    fs.mkdirSync(stateDir, { recursive: true });
  } catch {
    return safeError(
      "WIKI_STATE_DIR_UNAVAILABLE",
      "Wiki state directory is not writable.",
    );
  }
  if (fs.existsSync(lockPath)) {
    return {
      ...safeError("WIKI_BUSY", "Another wiki job is already running."),
      current_status: fs.existsSync(statusPath) ? status(stateDir) : null,
    };
  }

  const { apiUrl, token } = joplinConfig(env);
  if (!token) {
    return safeError(
      "JOPLIN_TOKEN_MISSING",
      "Joplin Data API token is not configured.",
    );
  }
  if (typeof fetchImpl !== "function") {
    return safeError("JOPLIN_API_UNAVAILABLE", "Fetch is not available.");
  }

  const startedAt = now().toISOString();
  fs.writeFileSync(lockPath, `${startedAt}\n`, { flag: "wx" });
  try {
    await fetchJson(
      fetchImpl,
      withToken(apiUrl, "folders", token, { fields: "id,title", limit: 1 }),
    );
    const notesPage = await fetchJson(
      fetchImpl,
      withToken(apiUrl, "notes", token, {
        fields: "id,title,parent_id,updated_time,body",
        limit: 100,
      }),
    );
    const rawNotes = notesPage.items || [];
    const notes = rawNotes.map(noteMetadata);
    writeRawNoteBodies(stateDir, rawNotes);
    writeJson(rawCachePath, { notes });

    const result = {
      ok: true,
      state: "synced",
      last_job: "sync",
      started_at: startedAt,
      finished_at: now().toISOString(),
      notes_seen: notes.length,
      warnings: [],
    };
    writeJson(statusPath, result);
    return result;
  } catch (error) {
    return safeError(
      error.code || "JOPLIN_API_UNAVAILABLE",
      error.message || "Joplin Data API is unavailable.",
    );
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

export function compile({ env = process.env, now = () => new Date() } = {}) {
  const stateDir = defaultStateDir(env);
  const lockPath = path.join(stateDir, "lock");
  const statusPath = path.join(stateDir, "status.json");
  const rawCachePath = path.join(stateDir, "raw", "notes-metadata.json");
  const compiledPath = path.join(stateDir, "compiled", "notes.json");

  if (!fs.existsSync(rawCachePath)) {
    return safeError(
      "WIKI_RAW_CACHE_MISSING",
      "Raw wiki cache is missing. Run wiki sync first.",
    );
  }
  if (fs.existsSync(lockPath)) {
    return {
      ...safeError("WIKI_BUSY", "Another wiki job is already running."),
      current_status: fs.existsSync(statusPath) ? status(stateDir) : null,
    };
  }

  const startedAt = now().toISOString();
  fs.writeFileSync(lockPath, `${startedAt}\n`, { flag: "wx" });
  try {
    const raw = readJson(rawCachePath);
    const notes = (raw.notes || []).map((note) => {
      const id = safeNoteId(note.id);
      const bodyPath = path.join(stateDir, "raw", "notes", `${id}.md`);
      if (!fs.existsSync(bodyPath)) {
        throw Object.assign(new Error("Raw note body is missing."), {
          code: "WIKI_RAW_BODY_MISSING",
        });
      }
      return {
        id,
        title: note.title || "",
        parent_id: note.parent_id || "",
        updated_time: note.updated_time || 0,
        body_hash: note.body_hash || "",
        plain_text: plainText(fs.readFileSync(bodyPath, "utf8")),
      };
    });
    writeJson(compiledPath, { notes });

    const result = {
      ok: true,
      state: "compiled",
      last_job: "compile",
      started_at: startedAt,
      finished_at: now().toISOString(),
      notes_compiled: notes.length,
      warnings: [],
    };
    writeJson(statusPath, result);
    return result;
  } catch (error) {
    return safeError(
      error.code || "WIKI_COMPILE_FAILED",
      error.message || "Wiki compile failed.",
    );
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

export function query(question, { env = process.env } = {}) {
  const stateDir = defaultStateDir(env);
  const compiledPath = path.join(stateDir, "compiled", "notes.json");
  if (!fs.existsSync(compiledPath)) {
    return safeError(
      "WIKI_COMPILED_INDEX_MISSING",
      "Compiled wiki index is missing. Run wiki compile first.",
    );
  }

  const terms = queryTerms(question);
  const compiled = readJson(compiledPath);
  const results = (compiled.notes || [])
    .map((note) => ({ note, score: noteScore(note, terms) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title))
    .map(({ note, score }) => ({
      id: note.id,
      title: note.title || "",
      snippet: snippet(note, terms),
      score,
    }));

  if (results.length === 0) {
    return {
      ok: true,
      state: "insufficient_data",
      message: "資料不足",
      results: [],
    };
  }
  return {
    ok: true,
    state: "queried",
    query: question,
    results,
  };
}

function notifyMessage(rest) {
  const messageFlagIndex = rest.indexOf("--message");
  if (messageFlagIndex < 0) return "";
  return rest.slice(messageFlagIndex + 1).join(" ").trim();
}

function isDiscordWebhookUrl(value) {
  return (
    value.startsWith("https://discord.com/api/webhooks/") ||
    value.startsWith("https://discordapp.com/api/webhooks/")
  );
}

export async function notifyDiscord(message, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!message) {
    return safeError("DISCORD_NOTIFY_MESSAGE_MISSING", "Notification message is required.");
  }
  const webhookUrl = discordSystemWebhookUrl(env);
  if (!webhookUrl) {
    return safeError(
      "DISCORD_SYSTEM_WEBHOOK_URL_MISSING",
      "Discord system notification webhook is not configured.",
    );
  }
  if (!isDiscordWebhookUrl(webhookUrl)) {
    return safeError(
      "DISCORD_SYSTEM_WEBHOOK_URL_INVALID",
      "Discord system notification webhook is invalid.",
    );
  }
  if (typeof fetchImpl !== "function") {
    return safeError("DISCORD_NOTIFY_UNAVAILABLE", "Fetch is not available.");
  }

  let response;
  try {
    response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    return safeError("DISCORD_NOTIFY_UNAVAILABLE", "Discord webhook is unavailable.");
  }
  if (!response.ok) {
    return safeError("DISCORD_NOTIFY_FAILED", "Discord webhook returned an error.");
  }
  return {
    ok: true,
    state: "notified",
    target: "discord_system",
  };
}

export function help() {
  return [
    "Usage: wiki <command>",
    "",
    "Commands:",
    "  status",
    "  sync",
    "  compile",
    '  query "問題"',
    '  notify discord --message "訊息"',
    "  draft telegram|discord ...",
    "  approve <draft-id>",
  ].join("\n");
}

function notImplemented(command) {
  return {
    ok: false,
    state: "not_implemented",
    message: `wiki ${command} 的 contract 已建立，實作留到後續 slice。`,
  };
}

export async function run(argv, env = process.env, deps = {}) {
  const { command, rest } = parseArgs(argv);
  if (command === "help") return help();
  if (command === "status") return JSON.stringify(status(defaultStateDir(env)), null, 2);
  if (command === "sync") {
    return JSON.stringify(await sync({ env, ...deps }), null, 2);
  }
  if (command === "compile") {
    return JSON.stringify(compile({ env, ...deps }), null, 2);
  }
  if (command === "query" && rest.length === 0) {
    return "請在 wiki query 後面加上問題。";
  }
  if (command === "query") {
    return JSON.stringify(query(rest.join(" "), { env }), null, 2);
  }
  if (command === "notify" && rest[0] === "discord") {
    return JSON.stringify(
      await notifyDiscord(notifyMessage(rest.slice(1)), { env, ...deps }),
      null,
      2,
    );
  }
  return JSON.stringify(notImplemented(command), null, 2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(await run(process.argv.slice(2)));
}
