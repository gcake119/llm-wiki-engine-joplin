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
  "read",
  "links",
  "audit",
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

function parseRef(value) {
  if (typeof value === "string" && value.includes(":")) {
    const [kind, id] = value.split(":", 2);
    return { kind, id };
  }
  return { kind: "note", id: value };
}

function noteBody(note) {
  if (typeof note.body !== "string") {
    throw Object.assign(new Error("Joplin note body is missing."), {
      code: "JOPLIN_NOTE_BODY_MISSING",
    });
  }
  return note.body;
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
  const body = noteBody(note);
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
    fs.writeFileSync(path.join(notesDir, `${safeNoteId(note.id)}.md`), noteBody(note));
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

function markdownNoteLinks(markdown) {
  return [...markdown.matchAll(/\]\(:\/([A-Za-z0-9_-]+)\)/g)].map((match) => match[1]);
}

function wikiSchema() {
  return {
    schema_version: 1,
    ref_kinds: ["note", "page"],
    draft_kinds: [...DRAFT_KINDS],
    page_model: {
      required_fields: [
        "page_id",
        "title",
        "aliases",
        "tags",
        "summary",
        "sections",
        "links",
        "sources",
      ],
      section_required_fields: ["heading", "text", "sources"],
    },
    governance_rules: [
      "source_required",
      "known_source_ref",
      "draft_target_required",
    ],
  };
}

function sourceBackedPages(notes) {
  return notes.map((note) => {
    const text = note.plain_text || "";
    const sections = text ? [
      {
        heading: "Source note",
        text,
        sources: [note.id],
      },
    ] : [];
    return {
      page_id: `page-${note.id}`,
      title: note.title || note.id,
      aliases: [],
      tags: [],
      summary: text,
      sections,
      links: [],
      sources: [note.id],
    };
  });
}

function writePageFiles(stateDir, pages) {
  for (const page of pages) {
    writeJson(path.join(stateDir, "compiled", "pages", `${safeNoteId(page.page_id)}.json`), page);
  }
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
    const rawNotes = [];
    let pagesSeen = 0;
    for (let page = 1; ; page += 1) {
      const notesPage = await fetchJson(
        fetchImpl,
        withToken(apiUrl, "notes", token, {
          fields: "id,title,parent_id,updated_time,body",
          limit: 100,
          page,
        }),
      );
      pagesSeen += 1;
      rawNotes.push(...(notesPage.items || []));
      if (!notesPage.has_more) break;
    }
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
      notes_written: rawNotes.length,
      pages_seen: pagesSeen,
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
  const pagesPath = path.join(stateDir, "compiled", "pages.json");
  const schemaPath = path.join(stateDir, "compiled", "schema.json");
  const graphPath = path.join(stateDir, "graph", "graph.json");

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
    const noteBodies = new Map();
    const notes = (raw.notes || []).map((note) => {
      const id = safeNoteId(note.id);
      const bodyPath = path.join(stateDir, "raw", "notes", `${id}.md`);
      if (!fs.existsSync(bodyPath)) {
        throw Object.assign(new Error("Raw note body is missing."), {
          code: "WIKI_RAW_BODY_MISSING",
        });
      }
      const body = fs.readFileSync(bodyPath, "utf8");
      noteBodies.set(id, body);
      return {
        id,
        title: note.title || "",
        parent_id: note.parent_id || "",
        updated_time: note.updated_time || 0,
        body_hash: note.body_hash || "",
        plain_text: plainText(body),
      };
    });
    const knownNoteIds = new Set(notes.map((note) => note.id));
    const markdownLinkEdges = notes.flatMap((note) => {
      return markdownNoteLinks(noteBodies.get(note.id) || "")
        .filter((targetId) => knownNoteIds.has(targetId))
        .map((targetId) => ({
          from: note.id,
          to: targetId,
          type: "markdown_link",
        }));
    });
    const pages = sourceBackedPages(notes);
    writeJson(compiledPath, { notes });
    writeJson(pagesPath, { pages });
    writeJson(schemaPath, wikiSchema());
    writePageFiles(stateDir, pages);
    writeJson(graphPath, {
      nodes: notes.map((note) => ({
        id: note.id,
        type: "note",
        title: note.title,
      })),
      edges: notes
        .filter((note) => note.parent_id)
        .map((note) => ({
          from: note.id,
          to: note.parent_id,
          type: "notebook_parent",
        }))
        .concat(markdownLinkEdges),
    });

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
    .slice(0, 5)
    .map(({ note, score }) => ({
      ref: `note:${note.id}`,
      kind: "note",
      id: note.id,
      title: note.title || "",
      parent_id: note.parent_id || "",
      snippet: snippet(note, terms),
      score,
    }));

  if (results.length === 0) {
    return {
      ok: true,
      state: "insufficient_data",
      evidence_status: "insufficient",
      message: "資料不足",
      results: [],
    };
  }
  return {
    ok: true,
    state: "queried",
    evidence_status: "source_backed",
    query: question,
    results,
  };
}

export function readNote(noteId, { env = process.env } = {}) {
  const stateDir = defaultStateDir(env);
  const ref = parseRef(noteId);
  if (ref.kind === "page") {
    return readPage(ref.id, { env });
  }

  const compiledPath = path.join(stateDir, "compiled", "notes.json");
  if (!fs.existsSync(compiledPath)) {
    return safeError(
      "WIKI_COMPILED_INDEX_MISSING",
      "Compiled wiki index is missing. Run wiki compile first.",
    );
  }

  let id;
  try {
    id = safeNoteId(ref.id);
  } catch {
    return {
      ...safeError("NOTE_NOT_FOUND", "Note was not found in local wiki artifacts."),
      evidence_status: "not_found",
    };
  }

  const compiled = readJson(compiledPath);
  const note = (compiled.notes || []).find((item) => item.id === id);
  if (!note) {
    return {
      ...safeError("NOTE_NOT_FOUND", "Note was not found in local wiki artifacts."),
      evidence_status: "not_found",
    };
  }

  const rawBody = path.join("raw", "notes", `${id}.md`);
  if (!fs.existsSync(path.join(stateDir, rawBody))) {
    return safeError("WIKI_RAW_BODY_MISSING", "Raw note body is missing.");
  }

  return {
    ok: true,
    id: note.id,
    title: note.title || "",
    parent_id: note.parent_id || "",
    body_hash: note.body_hash || "",
    plain_text: note.plain_text || "",
    source: {
      artifact: "compiled/notes.json",
      raw_body: rawBody,
    },
    evidence_status: "source_backed",
  };
}

export function readPage(pageId, { env = process.env } = {}) {
  const stateDir = defaultStateDir(env);
  const pagesPath = path.join(stateDir, "compiled", "pages.json");
  if (!fs.existsSync(pagesPath)) {
    return safeError(
      "WIKI_PAGE_INDEX_MISSING",
      "Compiled wiki page index is missing. Run wiki compile first.",
    );
  }

  let id;
  try {
    id = safeNoteId(pageId);
  } catch {
    return {
      ...safeError("NOTE_NOT_FOUND", "Page was not found in local wiki artifacts."),
      evidence_status: "not_found",
    };
  }

  const pages = readJson(pagesPath);
  const page = (pages.pages || []).find((item) => item.page_id === id);
  if (!page) {
    return {
      ...safeError("NOTE_NOT_FOUND", "Page was not found in local wiki artifacts."),
      evidence_status: "not_found",
    };
  }

  return {
    ok: true,
    kind: "page",
    ref: `page:${id}`,
    page,
    source: {
      artifact: "compiled/pages.json",
      page_file: path.join("compiled", "pages", `${id}.json`),
    },
    evidence_status: "source_backed",
  };
}

export function links(noteId, { env = process.env } = {}) {
  const stateDir = defaultStateDir(env);
  const graphPath = path.join(stateDir, "graph", "graph.json");
  if (!fs.existsSync(graphPath)) {
    return {
      ...safeError("GRAPH_NOT_FOUND", "Graph artifact is missing. Run wiki compile first."),
      evidence_status: "graph_missing",
    };
  }

  const ref = parseRef(noteId);
  let id;
  try {
    id = safeNoteId(ref.id);
  } catch {
    return {
      ...safeError("NOTE_NOT_FOUND", "Note was not found in local wiki graph."),
      evidence_status: "not_found",
    };
  }

  const graph = readJson(graphPath);
  const nodeById = new Map((graph.nodes || []).map((node) => [node.id, node]));
  if (ref.kind === "page") {
    return pageLinks(id, { env, nodeById });
  }

  if (!nodeById.has(id)) {
    return {
      ...safeError("NOTE_NOT_FOUND", "Note was not found in local wiki graph."),
      evidence_status: "not_found",
    };
  }

  const edges = (graph.edges || []).filter((edge) => edge.from === id || edge.to === id);
  const neighbors = edges.map((edge) => {
    const outbound = edge.from === id;
    const neighborId = outbound ? edge.to : edge.from;
    const neighbor = nodeById.get(neighborId) || {};
    return {
      id: neighborId,
      type: neighbor.type || "unknown",
      title: neighbor.title || "",
      via: edge.type || "",
      direction: outbound ? "outbound" : "inbound",
    };
  });

  return {
    ok: true,
    id,
    neighbors,
    edges,
    evidence_status: "source_backed",
  };
}

function pageLinks(pageId, { env = process.env, nodeById = new Map() } = {}) {
  const stateDir = defaultStateDir(env);
  const pagesPath = path.join(stateDir, "compiled", "pages.json");
  if (!fs.existsSync(pagesPath)) {
    return safeError(
      "WIKI_PAGE_INDEX_MISSING",
      "Compiled wiki page index is missing. Run wiki compile first.",
    );
  }

  const pages = readJson(pagesPath);
  const page = (pages.pages || []).find((item) => item.page_id === pageId);
  if (!page) {
    return {
      ...safeError("NOTE_NOT_FOUND", "Page was not found in local wiki graph."),
      evidence_status: "not_found",
    };
  }

  const edges = (page.sources || []).map((sourceId) => ({
    from: pageId,
    to: sourceId,
    type: "page_source",
  }));
  const neighbors = edges.map((edge) => {
    const neighbor = nodeById.get(edge.to) || {};
    return {
      id: edge.to,
      type: neighbor.type || "note",
      title: neighbor.title || "",
      via: edge.type,
      direction: "outbound",
    };
  });

  return {
    ok: true,
    id: pageId,
    kind: "page",
    ref: `page:${pageId}`,
    neighbors,
    edges,
    evidence_status: "source_backed",
  };
}

function countByKind(entries) {
  return entries.reduce((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] || 0) + 1;
    return counts;
  }, {});
}

function auditEntry(kind, ref, message, artifact) {
  return { kind, ref, message, artifact };
}

function readDrafts(stateDir) {
  const draftsDir = path.join(stateDir, "drafts");
  if (!fs.existsSync(draftsDir)) return [];
  return fs.readdirSync(draftsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJson(path.join(draftsDir, entry)));
}

export function audit({ env = process.env } = {}) {
  const stateDir = defaultStateDir(env);
  const notesPath = path.join(stateDir, "compiled", "notes.json");
  const pagesPath = path.join(stateDir, "compiled", "pages.json");
  const graphPath = path.join(stateDir, "graph", "graph.json");
  const reviewPath = path.join(stateDir, "review", "consolidation-reviews.json");
  const entries = [];

  const notes = fs.existsSync(notesPath) ? readJson(notesPath).notes || [] : [];
  const noteIds = new Set(notes.map((note) => note.id));
  const pages = fs.existsSync(pagesPath) ? readJson(pagesPath).pages || [] : [];
  const pageIds = new Set(pages.map((page) => page.page_id));

  if (fs.existsSync(graphPath)) {
    const graph = readJson(graphPath);
    const nodeIds = new Set((graph.nodes || []).map((node) => node.id));
    for (const edge of graph.edges || []) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        entries.push(auditEntry(
          "dangling_link",
          `${edge.from}->${edge.to}`,
          "Graph edge references a missing node.",
          "graph/graph.json",
        ));
      }
    }
  }

  if (pages.length > 0) {
    for (const page of pages) {
      for (const link of page.links || []) {
        if (!pageIds.has(link)) {
          entries.push(auditEntry(
            "dangling_link",
            `${page.page_id}->${link}`,
            "Page links to a missing page ref.",
            "compiled/pages.json",
          ));
        }
      }
      for (const section of page.sections || []) {
        if ((section.text || "").trim() && (!section.sources || section.sources.length === 0)) {
          entries.push(auditEntry(
            "evidence_gap",
            `${page.page_id}#${section.heading || "section"}`,
            "Fact-bearing section has no source note references.",
            "compiled/pages.json",
          ));
        }
        for (const sourceId of section.sources || []) {
          if (!noteIds.has(sourceId)) {
            entries.push(auditEntry(
              "missing_source",
              `${page.page_id}#${section.heading || "section"}:${sourceId}`,
              "Section references a missing source note.",
              "compiled/pages.json",
            ));
          }
        }
      }
      for (const sourceId of page.sources || []) {
        if (!noteIds.has(sourceId)) {
          entries.push(auditEntry(
            "missing_source",
            `${page.page_id}:${sourceId}`,
            "Page references a missing source note.",
            "compiled/pages.json",
          ));
        }
      }
    }
  }

  for (const draftData of readDrafts(stateDir)) {
    if (draftData.kind !== "consolidate") continue;
    if (!draftData.intended_target?.notebook_id) {
      entries.push(auditEntry(
        "draft_target_missing",
        draftData.draft_id || "unknown-draft",
        "Consolidation draft has no target notebook id.",
        "drafts",
      ));
    }
    for (const refValue of draftData.provenance?.refs || []) {
      const ref = parseRef(refValue);
      const known =
        (ref.kind === "note" && noteIds.has(ref.id)) ||
        (ref.kind === "page" && pageIds.has(ref.id));
      if (!known) {
        entries.push(auditEntry(
          "missing_source",
          `${draftData.draft_id || "unknown-draft"}:${refValue}`,
          "Consolidation draft references a missing source ref.",
          "drafts",
        ));
      }
    }
  }

  entries.sort((a, b) => {
    return a.kind.localeCompare(b.kind) || a.ref.localeCompare(b.ref);
  });
  const reviews = fs.existsSync(reviewPath) ? readJson(reviewPath).reviews || [] : [];
  const reviewCounts = {};
  for (const review of reviews) {
    reviewCounts[review.decision] = (reviewCounts[review.decision] || 0) + 1;
  }
  const result = {
    ok: true,
    state: "audited",
    total_errors: entries.length,
    kind_counts: countByKind(entries),
    review_counts: reviewCounts,
  };
  writeJson(path.join(stateDir, "audit", "error-book.json"), {
    entries,
    kind_counts: result.kind_counts,
    total_errors: result.total_errors,
    review_counts: reviewCounts,
  });
  return result;
}

const DRAFT_KINDS = new Set(["telegram", "discord", "feedback", "consolidate"]);

function draftParts(rest) {
  const refs = [];
  const content = [];
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--ref" && rest[index + 1]) {
      refs.push(rest[index + 1]);
      index += 1;
    } else {
      content.push(rest[index]);
    }
  }
  return { refs, content: content.join(" ").trim() };
}

function validateDraftRefs(kind, refs) {
  if (kind !== "consolidate") return null;
  for (const refValue of refs) {
    const ref = parseRef(refValue);
    if (!["note", "page"].includes(ref.kind)) {
      return safeError("DRAFT_REF_UNSAFE", "Draft ref kind is not supported.");
    }
    try {
      safeNoteId(ref.id);
    } catch {
      return safeError("DRAFT_REF_UNSAFE", "Draft ref is not safe.");
    }
  }
  return null;
}

function boundedText(value, limit = 280) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
}

function resolveConsolidationSources(refs, stateDir) {
  const notesPath = path.join(stateDir, "compiled", "notes.json");
  const pagesPath = path.join(stateDir, "compiled", "pages.json");
  const notes = fs.existsSync(notesPath) ? readJson(notesPath).notes || [] : [];
  const pages = fs.existsSync(pagesPath) ? readJson(pagesPath).pages || [] : [];

  return refs.map((refValue) => {
    const ref = parseRef(refValue);
    if (ref.kind === "note") {
      const note = notes.find((item) => item.id === ref.id);
      if (!note) return null;
      return {
        ref: refValue,
        title: note.title || ref.id,
        excerpt: boundedText(note.plain_text),
      };
    }

    const pagePath = path.join(stateDir, "compiled", "pages", `${ref.id}.json`);
    const page = pages.find((item) => item.page_id === ref.id) ||
      (fs.existsSync(pagePath) ? readJson(pagePath) : null);
    if (!page) return null;
    const sectionText = (page.sections || []).map((section) => section.text).join(" ");
    return {
      ref: refValue,
      title: page.title || ref.id,
      excerpt: boundedText(page.summary || sectionText),
    };
  });
}

function consolidationContent(goal, sources) {
  return [
    `# ${goal}`,
    "",
    "## Sources",
    ...sources.map((source) => `- ${source.ref} — ${source.title}`),
    "",
    "## Extracted notes",
    ...sources.map((source) => [
      `### ${source.title}`,
      `Ref: ${source.ref}`,
      source.excerpt || "No local excerpt available.",
    ].join("\n")),
  ].join("\n");
}

function candidateTopic(title) {
  const words = String(title || "")
    .replace(/\bpart\s+\d+\b/gi, "")
    .replace(/\b\d+\b/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).join(" ");
}

function candidateId(refs) {
  return `candidate-${crypto
    .createHash("sha256")
    .update(refs.join("\n"))
    .digest("hex")
    .slice(0, 12)}`;
}

export function draftCandidates(rest = [], { env = process.env, now = () => new Date() } = {}) {
  const stateDir = defaultStateDir(env);
  const notesPath = path.join(stateDir, "compiled", "notes.json");
  if (!fs.existsSync(notesPath)) {
    return safeError("WIKI_COMPILED_INDEX_MISSING", "Run wiki compile before candidate discovery.");
  }

  const limitIndex = rest.indexOf("--limit");
  const limit = limitIndex >= 0 ? Math.max(0, Number.parseInt(rest[limitIndex + 1], 10) || 0) : 10;
  const groups = new Map();
  for (const note of readJson(notesPath).notes || []) {
    const topic = candidateTopic(note.title);
    if (!topic) continue;
    const group = groups.get(topic) || [];
    group.push(note);
    groups.set(topic, group);
  }

  const candidates = [...groups.entries()]
    .filter(([, notes]) => notes.length > 1)
    .sort(([topicA], [topicB]) => topicA.localeCompare(topicB))
    .slice(0, limit)
    .map(([topic, notes]) => {
      const refs = notes.map((note) => `note:${note.id}`);
      return {
        candidate_id: candidateId(refs),
        refs,
        reason: "related_title",
        priority: "medium",
        goal: `Consolidate ${topic} notes`,
        status: "pending_review",
      };
    });

  const artifact = {
    created_at: now().toISOString(),
    candidates,
  };
  writeJson(path.join(stateDir, "candidates", "consolidation-candidates.json"), artifact);
  return {
    ok: true,
    state: "candidates_found",
    candidates,
    path: path.join("candidates", "consolidation-candidates.json"),
  };
}

export function draftCandidate(candidateIdValue, { env = process.env, now = () => new Date() } = {}) {
  let id;
  try {
    id = safeNoteId(candidateIdValue);
  } catch {
    return safeError("DRAFT_CANDIDATE_MISSING", "Candidate was not found.");
  }

  const stateDir = defaultStateDir(env);
  const candidatesPath = path.join(stateDir, "candidates", "consolidation-candidates.json");
  const candidates = fs.existsSync(candidatesPath) ? readJson(candidatesPath).candidates || [] : [];
  const candidate = candidates.find((item) => item.candidate_id === id);
  if (!candidate) {
    return safeError("DRAFT_CANDIDATE_MISSING", "Candidate was not found.");
  }

  const result = draft(
    "consolidate",
    [...candidate.refs.flatMap((ref) => ["--ref", ref]), candidate.goal],
    { env, now },
  );
  if (!result.ok) return result;

  const draftPath = path.join(stateDir, "drafts", `${result.draft_id}.json`);
  const draftData = readJson(draftPath);
  draftData.provenance.candidate_id = candidate.candidate_id;
  writeJson(draftPath, draftData);
  writeReviewEvidence(stateDir, draftData, "pending", "", now);
  return result;
}

export function draft(kind, rest = [], { env = process.env, now = () => new Date() } = {}) {
  if (!DRAFT_KINDS.has(kind)) {
    return safeError("DRAFT_KIND_UNSUPPORTED", "Draft kind is not supported.");
  }

  const { refs, content } = draftParts(rest);
  const refError = validateDraftRefs(kind, refs);
  if (refError) return refError;
  if (!content) {
    return safeError("DRAFT_CONTENT_MISSING", "Draft content is required.");
  }

  const stateDir = defaultStateDir(env);
  let draftContent = content;
  if (kind === "consolidate") {
    const sources = resolveConsolidationSources(refs, stateDir);
    if (sources.some((source) => !source)) {
      return safeError("DRAFT_SOURCE_MISSING", "Draft source was not found in compiled artifacts.");
    }
    draftContent = consolidationContent(content, sources);
  }

  const createdAt = now().toISOString();
  const draftId = `draft-${kind}-${crypto
    .createHash("sha256")
    .update(`${kind}\n${refs.join("\n")}\n${draftContent}`)
    .digest("hex")
    .slice(0, 12)}`;
  const draftData = {
    draft_id: draftId,
    kind,
    status: "pending_review",
    created_at: createdAt,
    content: draftContent,
    provenance: {
      source: kind,
      input: "cli",
      refs,
    },
    intended_target: {
      type: "joplin_inbox",
      notebook_id: "",
      conflict_behavior: "manual_review",
    },
  };
  writeJson(path.join(stateDir, "drafts", `${draftId}.json`), draftData);

  return {
    ok: true,
    state: "drafted",
    draft_id: draftId,
    kind,
    path: path.join("drafts", `${draftId}.json`),
  };
}

function validApprovalDraft(draftData) {
  return Boolean(
    draftData &&
    draftData.provenance &&
    draftData.intended_target &&
    draftData.intended_target.notebook_id &&
    draftData.intended_target.conflict_behavior &&
    draftData.content,
  );
}

function writeReviewEvidence(stateDir, draftData, decision, joplinNoteId, now) {
  if (draftData.kind !== "consolidate" || !draftData.provenance?.candidate_id) return;
  const reviewPath = path.join(stateDir, "review", "consolidation-reviews.json");
  const state = fs.existsSync(reviewPath) ? readJson(reviewPath) : { reviews: [] };
  state.reviews.push({
    candidate_id: draftData.provenance.candidate_id,
    draft_id: draftData.draft_id,
    decision,
    joplin_note_id: joplinNoteId || "",
    decided_at: now().toISOString(),
    rollback: joplinNoteId ? { joplin_note_id: joplinNoteId } : {},
  });
  writeJson(reviewPath, state);
}

export function rejectDraft(draftId, { env = process.env, now = () => new Date() } = {}) {
  let id;
  try {
    id = safeNoteId(draftId);
  } catch {
    return safeError("DRAFT_NOT_FOUND", "Draft was not found.");
  }

  const stateDir = defaultStateDir(env);
  const draftPath = path.join(stateDir, "drafts", `${id}.json`);
  if (!fs.existsSync(draftPath)) {
    return safeError("DRAFT_NOT_FOUND", "Draft was not found.");
  }

  const draftData = readJson(draftPath);
  writeReviewEvidence(stateDir, draftData, "rejected", "", now);
  draftData.status = "rejected";
  writeJson(draftPath, draftData);
  return { ok: true, state: "rejected", draft_id: id };
}

export async function approve(
  draftId,
  { env = process.env, fetchImpl = globalThis.fetch, now = () => new Date() } = {},
) {
  let id;
  try {
    id = safeNoteId(draftId);
  } catch {
    return safeError("DRAFT_NOT_FOUND", "Draft was not found.");
  }

  const draftPath = path.join(defaultStateDir(env), "drafts", `${id}.json`);
  if (!fs.existsSync(draftPath)) {
    return safeError("DRAFT_NOT_FOUND", "Draft was not found.");
  }

  const stateDir = defaultStateDir(env);
  const draftData = readJson(draftPath);
  if (!validApprovalDraft(draftData)) {
    return safeError(
      "DRAFT_APPROVAL_INVALID",
      "Draft is missing provenance, target notebook, conflict behavior, or content.",
    );
  }

  const { apiUrl, token } = joplinConfig(env);
  if (!token) {
    return safeError(
      "JOPLIN_TOKEN_MISSING",
      "Joplin Data API token is not configured.",
    );
  }
  if (typeof fetchImpl !== "function") {
    return safeError("JOPLIN_WRITEBACK_FAILED", "Joplin writeback is unavailable.");
  }

  let response;
  try {
    response = await fetchImpl(withToken(apiUrl, "notes", token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draftData.content.split(/\n/)[0].slice(0, 80) || "Wiki draft",
        body: draftData.content,
        parent_id: draftData.intended_target.notebook_id,
      }),
    });
  } catch {
    return safeError("JOPLIN_WRITEBACK_FAILED", "Joplin writeback failed.");
  }
  if (!response.ok) {
    return safeError("JOPLIN_WRITEBACK_FAILED", "Joplin writeback failed.");
  }
  const note = await response.json();
  writeReviewEvidence(stateDir, draftData, "approved", note.id || "", now);
  return {
    ok: true,
    state: "approved",
    draft_id: id,
    joplin_note_id: note.id || "",
  };
}

function notifyMessage(rest) {
  const messageFlagIndex = rest.indexOf("--message");
  if (messageFlagIndex < 0) return "";
  return rest.slice(messageFlagIndex + 1).join(" ").trim();
}

function wantsNotify(rest) {
  return rest.includes("--notify");
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

function systemNotificationMessage(command, result) {
  if (result.ok) {
    const count =
      command === "sync" ? `notes_seen=${result.notes_seen ?? 0}` :
      command === "compile" ? `notes_compiled=${result.notes_compiled ?? 0}` :
      "";
    return `[Hermes Wiki] ${command} 成功${count ? `：${count}` : ""}`;
  }
  return `[Hermes Wiki] ${command} 失敗：${result.code || "UNKNOWN_ERROR"}`;
}

async function withSystemNotification(command, result, { env, fetchImpl }) {
  return {
    ...result,
    notification: await notifyDiscord(systemNotificationMessage(command, result), {
      env,
      fetchImpl,
    }),
  };
}

export function help() {
  return [
    "Usage: wiki <command>",
    "",
    "Commands:",
    "  status",
    "  sync [--notify]",
    "  compile [--notify]",
    '  query "問題"',
    "  read <note-id>",
    "  links <note-id>",
    "  audit",
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
    const result = await sync({ env, ...deps });
    return JSON.stringify(
      wantsNotify(rest) ? await withSystemNotification("sync", result, { env, ...deps }) : result,
      null,
      2,
    );
  }
  if (command === "compile") {
    const result = compile({ env, ...deps });
    return JSON.stringify(
      wantsNotify(rest) ? await withSystemNotification("compile", result, { env, ...deps }) : result,
      null,
      2,
    );
  }
  if (command === "query" && rest.length === 0) {
    return "請在 wiki query 後面加上問題。";
  }
  if (command === "query") {
    return JSON.stringify(query(rest.join(" "), { env }), null, 2);
  }
  if (command === "read") {
    return JSON.stringify(readNote(rest[0], { env }), null, 2);
  }
  if (command === "links") {
    return JSON.stringify(links(rest[0], { env }), null, 2);
  }
  if (command === "audit") {
    return JSON.stringify(audit({ env }), null, 2);
  }
  if (command === "draft") {
    if (rest[0] === "candidates") {
      return JSON.stringify(draftCandidates(rest.slice(1), { env, ...deps }), null, 2);
    }
    if (rest[0] === "candidate") {
      return JSON.stringify(draftCandidate(rest[1], { env, ...deps }), null, 2);
    }
    if (rest[0] === "reject") {
      return JSON.stringify(rejectDraft(rest[1], { env, ...deps }), null, 2);
    }
    return JSON.stringify(draft(rest[0], rest.slice(1), { env, ...deps }), null, 2);
  }
  if (command === "approve") {
    return JSON.stringify(await approve(rest[0], { env, ...deps }), null, 2);
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
