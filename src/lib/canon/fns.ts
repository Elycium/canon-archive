import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { mapEntry, type EntryRow } from "./db-map";
import {
  cosine,
  documentSearchText,
  embedText,
  hybridScore,
  lexicalScore,
  normalizeQuery,
} from "./embed";
import { STARTER_LIBRARY } from "./seed";
import type {
  AgentMessage,
  CanonDoc,
  CaptureResult,
  EntryKind,
  EntryRecord,
  EntryVersion,
  LibraryHit,
  SearchMode,
} from "./types";
import { isEntryKind, isSearchMode } from "./types";
import {
  agentReply,
  aiAvailable,
  applyVariables,
  classifyCapture,
  expandSearchQuery,
  rebuildCanonDocument,
  runEntryChat,
} from "./xai";

function jsonb(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function insertEntry(
  userId: string,
  input: {
    id: string;
    lineageId: string;
    version: number;
    kind: EntryKind;
    title: string;
    body: string;
    summary: string;
    tags: string[];
    variables: string[];
    phrases: string[];
    embedding: number[];
    structure: unknown;
    isStarter: boolean;
  },
): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into entries (
      id, user_id, lineage_id, version, kind, title, body, summary,
      tags, variables, semantic_phrases, embedding, structure, is_starter
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14)`,
    [
      input.id,
      userId,
      input.lineageId,
      input.version,
      input.kind,
      input.title,
      input.body,
      input.summary,
      jsonb(input.tags),
      jsonb(input.variables),
      jsonb(input.phrases),
      jsonb(input.embedding),
      input.structure ? jsonb(input.structure) : null,
      input.isStarter,
    ],
  );
  await sql.query(
    `insert into entry_versions (entry_id, user_id, version, kind, title, body, summary)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [input.id, userId, input.version, input.kind, input.title, input.body, input.summary],
  );
}

async function listRows(userId: string): Promise<EntryRecord[]> {
  const sql = await getSql();
  const rows = await sql.query<EntryRow>(
    `select * from entries where user_id = $1 order by updated_at desc`,
    [userId],
  );
  return rows.map(mapEntry);
}

async function ensureStarter(userId: string): Promise<void> {
  const sql = await getSql();
  const countRows = await sql.query<{ n: number }>(
    `select count(*)::int as n from entries where user_id = $1`,
    [userId],
  );
  if ((countRows[0]?.n ?? 0) > 0) return;
  for (const draft of STARTER_LIBRARY) {
    const embedding = embedText(
      documentSearchText({
        kind: draft.kind,
        title: draft.title,
        summary: draft.summary,
        tags: draft.tags,
        phrases: draft.semanticPhrases,
        body: draft.body,
      }),
    );
    const id = crypto.randomUUID();
    await insertEntry(userId, {
      id,
      lineageId: id,
      version: 1,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      summary: draft.summary,
      tags: draft.tags,
      variables: draft.variables,
      phrases: draft.semanticPhrases,
      embedding,
      structure: draft.structure,
      isStarter: true,
    });
  }
}

function fallbackTitle(body: string): string {
  const line =
    body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#")) ?? "Untitled capture";
  return line.replace(/^#+\s*/, "").slice(0, 72);
}

export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => ({ available: aiAvailable() }));

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureStarter(context.userId);
    const entries = await listRows(context.userId);
    return entries.map((entry) => toHit(entry));
  });

function toHit(entry: EntryRecord, score = 1, reasons: string[] = []): LibraryHit {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    summary: entry.summary,
    tags: entry.tags,
    starred: entry.starred,
    isStarter: entry.isStarter,
    version: entry.version,
    updatedAt: entry.updatedAt,
    score,
    reasons,
  };
}

export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { query: string; kind?: string; starredOnly?: boolean; mode?: string; deepen?: boolean }) => ({
    query: typeof input.query === "string" ? input.query : "",
    kind: typeof input.kind === "string" && isEntryKind(input.kind) ? input.kind : "all",
    starredOnly: Boolean(input.starredOnly),
    mode: typeof input.mode === "string" && isSearchMode(input.mode) ? input.mode : "semantic",
    deepen: Boolean(input.deepen),
  }))
  .handler(async ({ context, data }): Promise<{ hits: LibraryHit[]; expanded: string[]; intent: string; mode: SearchMode }> => {
    await ensureStarter(context.userId);
    const entries = await listRows(context.userId);
    const filtered = entries.filter((entry) => {
      if (data.kind !== "all" && entry.kind !== data.kind) return false;
      if (data.starredOnly && !entry.starred) return false;
      return true;
    });
    const query = data.query.trim();
    if (!query) {
      return { hits: filtered.map((e) => toHit(e, 1, [])), expanded: [], intent: "", mode: data.mode };
    }
    if (data.mode === "exact") {
      const q = query.toLowerCase();
      const hits = filtered
        .map((entry) => {
          const { score, reasons } = lexicalScore(query, {
            title: entry.title,
            summary: entry.summary,
            body: entry.body,
            tags: entry.tags,
            phrases: entry.semanticPhrases,
          });
          const blob = `${entry.title}\n${entry.summary}\n${entry.body}\n${entry.tags.join(" ")}`.toLowerCase();
          if (!blob.includes(q) && score < 0.15) return null;
          return toHit(entry, Math.max(score, blob.includes(q) ? 0.5 : 0), reasons);
        })
        .filter((hit): hit is LibraryHit => Boolean(hit))
        .sort((a, b) => b.score - a.score);
      return { hits, expanded: [], intent: "", mode: "exact" };
    }
    let expanded: string[] = [];
    let intent = "";
    if (data.deepen && query.length >= 3 && aiAvailable()) {
      const sql = await getSql();
      const norm = normalizeQuery(query);
      const cached = await sql.query<{ terms: unknown; intent: string }>(
        `select terms, intent from search_expansions where user_id = $1 and query_norm = $2`,
        [context.userId, norm],
      );
      if (cached[0]) {
        expanded = Array.isArray(cached[0].terms)
          ? (cached[0].terms as unknown[]).filter((t): t is string => typeof t === "string")
          : [];
        intent = cached[0].intent ?? "";
      } else {
        const expansion = await expandSearchQuery(query);
        if (expansion) {
          expanded = expansion.terms;
          intent = expansion.intent;
          await sql.query(
            `insert into search_expansions (user_id, query_norm, terms, intent)
             values ($1,$2,$3::jsonb,$4)
             on conflict (user_id, query_norm) do update set terms = excluded.terms, intent = excluded.intent`,
            [context.userId, norm, jsonb(expanded), intent],
          );
        }
      }
    }
    const queryVec = embedText([query, intent, expanded.join(" ")].filter(Boolean).join("\n"));
    const hits = filtered
      .map((entry) => {
        const lex = lexicalScore(query, {
          title: entry.title,
          summary: entry.summary,
          body: entry.body,
          tags: entry.tags,
          phrases: entry.semanticPhrases,
        });
        const sim = cosine(queryVec, entry.embedding);
        const score = hybridScore(sim, lex.score);
        const reasons = [...lex.reasons];
        if (sim >= 0.22 && reasons.length < 4) reasons.push("similar meaning");
        return { hit: toHit(entry, score, reasons.slice(0, 4)), sim, lex: lex.score };
      })
      .filter((row) => row.hit.score >= 0.08 || row.lex >= 0.12 || row.sim >= 0.18)
      .sort((a, b) => b.hit.score - a.hit.score)
      .map((row) => row.hit);
    return { hits, expanded, intent, mode: "semantic" };
  });

export const getEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }): Promise<EntryRecord | null> => {
    const sql = await getSql();
    const rows = await sql.query<EntryRow>(
      `select * from entries where id = $1 and user_id = $2`,
      [id, context.userId],
    );
    return rows[0] ? mapEntry(rows[0]) : null;
  });

export const getEntryVersions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }): Promise<EntryVersion[]> => {
    const sql = await getSql();
    const rows = await sql.query<{ version: number; title: string; summary: string; created_at: string | Date }>(
      `select version, title, summary, created_at from entry_versions
       where entry_id = $1 and user_id = $2 order by version desc`,
      [id, context.userId],
    );
    return rows.map((row) => ({
      version: Number(row.version),
      title: row.title,
      summary: row.summary,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  });

export const captureEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { body: string; kind?: string }) => ({
    body: typeof input.body === "string" ? input.body.trim() : "",
    kind: typeof input.kind === "string" && isEntryKind(input.kind) ? input.kind : undefined,
  }))
  .handler(async ({ context, data }): Promise<CaptureResult> => {
    if (!data.body) throw new Error("Paste something to capture.");
    await ensureStarter(context.userId);
    const filed = await classifyCapture(data.body);
    const kind: EntryKind = data.kind ?? filed?.kind ?? "prompt";
    const title = filed?.title || fallbackTitle(data.body);
    const summary = filed?.summary || data.body.replace(/\s+/g, " ").slice(0, 180);
    const tags = filed?.tags?.length ? filed.tags : [kind];
    const phrases = filed?.semanticPhrases ?? [];
    const embedding = embedText(
      documentSearchText({ kind, title, summary, tags, phrases, body: data.body }),
    );
    const id = crypto.randomUUID();
    await insertEntry(context.userId, {
      id,
      lineageId: id,
      version: 1,
      kind,
      title,
      body: data.body,
      summary,
      tags,
      variables: filed?.variables ?? [],
      phrases,
      embedding,
      structure: filed?.structure ?? null,
      isStarter: false,
    });
    const sql = await getSql();
    const rows = await sql.query<EntryRow>(
      `select * from entries where id = $1 and user_id = $2`,
      [id, context.userId],
    );
    return { entry: mapEntry(rows[0]!), filedByAi: Boolean(filed) };
  });

export const updateEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string; title?: string }) => ({
    id: input.id,
    body: input.body.trim(),
    title: input.title?.trim(),
  }))
  .handler(async ({ context, data }): Promise<EntryRecord> => {
    if (!data.body) throw new Error("Body cannot be empty.");
    const sql = await getSql();
    const rows = await sql.query<EntryRow>(
      `select * from entries where id = $1 and user_id = $2`,
      [data.id, context.userId],
    );
    const current = rows[0] ? mapEntry(rows[0]) : null;
    if (!current) throw new Error("Not found");
    const filed = await classifyCapture(data.body);
    const kind = filed?.kind ?? current.kind;
    const title = data.title || filed?.title || current.title;
    const summary = filed?.summary || current.summary;
    const tags = filed?.tags?.length ? filed.tags : current.tags;
    const phrases = filed?.semanticPhrases?.length ? filed.semanticPhrases : current.semanticPhrases;
    const variables = filed?.variables?.length ? filed.variables : current.variables;
    const structure = filed?.structure ?? current.structure;
    const version = current.version + 1;
    const embedding = embedText(
      documentSearchText({ kind, title, summary, tags, phrases, body: data.body }),
    );
    await sql.query(
      `update entries set
        version = $1, kind = $2, title = $3, body = $4, summary = $5,
        tags = $6::jsonb, variables = $7::jsonb, semantic_phrases = $8::jsonb,
        embedding = $9::jsonb, structure = $10::jsonb, updated_at = now()
       where id = $11 and user_id = $12`,
      [version, kind, title, data.body, summary, jsonb(tags), jsonb(variables), jsonb(phrases), jsonb(embedding), structure ? jsonb(structure) : null, data.id, context.userId],
    );
    await sql.query(
      `insert into entry_versions (entry_id, user_id, version, kind, title, body, summary)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [data.id, context.userId, version, kind, title, data.body, summary],
    );
    const next = await sql.query<EntryRow>(`select * from entries where id = $1 and user_id = $2`, [data.id, context.userId]);
    return mapEntry(next[0]!);
  });

export const toggleStar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql.query(
      `update entries set starred = not starred, updated_at = now() where id = $1 and user_id = $2`,
      [id, context.userId],
    );
    const rows = await sql.query<{ starred: boolean }>(`select starred from entries where id = $1 and user_id = $2`, [id, context.userId]);
    return { starred: Boolean(rows[0]?.starred) };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql.query(`delete from run_messages where entry_id = $1 and user_id = $2`, [id, context.userId]);
    await sql.query(`delete from entry_versions where entry_id = $1 and user_id = $2`, [id, context.userId]);
    await sql.query(`delete from entries where id = $1 and user_id = $2`, [id, context.userId]);
    return { ok: true as const };
  });

export const getCanon = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CanonDoc | null> => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; version: number; body: string; created_at: string | Date }>(
      `select id, version, body, created_at from canon_docs where user_id = $1 order by version desc limit 1`,
      [context.userId],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, version: Number(row.version), body: row.body, createdAt: new Date(row.created_at).toISOString() };
  });

export const rebuildCanon = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CanonDoc> => {
    if (!aiAvailable()) throw new Error("AI is not available in this environment");
    await ensureStarter(context.userId);
    const entries = await listRows(context.userId);
    const body = await rebuildCanonDocument(
      entries.map((e) => ({ kind: e.kind, title: e.title, summary: e.summary, tags: e.tags })),
    );
    if (!body) throw new Error("Could not rebuild Canon");
    const sql = await getSql();
    const prev = await sql.query<{ version: number }>(`select version from canon_docs where user_id = $1 order by version desc limit 1`, [context.userId]);
    const version = (prev[0]?.version ?? 0) + 1;
    const id = crypto.randomUUID();
    await sql.query(`insert into canon_docs (id, user_id, version, body) values ($1,$2,$3,$4)`, [id, context.userId, version, body]);
    return { id, version, body, createdAt: new Date().toISOString() };
  });

export const listAgentMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AgentMessage[]> => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; role: string; content: string; created_at: string | Date }>(
      `select id, role, content, created_at from agent_messages where user_id = $1 order by created_at asc`,
      [context.userId],
    );
    return rows.map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  });

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((content: string) => content.trim())
  .handler(async ({ context, data: content }): Promise<AgentMessage[]> => {
    if (!content) throw new Error("Say something.");
    if (!aiAvailable()) throw new Error("AI is not available in this environment");
    await ensureStarter(context.userId);
    const sql = await getSql();
    await sql.query(`insert into agent_messages (id, user_id, role, content) values ($1,$2,$3,$4)`, [crypto.randomUUID(), context.userId, "user", content]);
    const historyRows = await sql.query<{ role: string; content: string }>(`select role, content from agent_messages where user_id = $1 order by created_at asc`, [context.userId]);
    const entries = await listRows(context.userId);
    const canonRows = await sql.query<{ body: string }>(`select body from canon_docs where user_id = $1 order by version desc limit 1`, [context.userId]);
    const reply = await agentReply({
      question: content,
      history: historyRows.slice(0, -1).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      catalog: entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title, summary: e.summary, tags: e.tags })),
      canonExcerpt: canonRows[0]?.body ?? "",
    });
    await sql.query(`insert into agent_messages (id, user_id, role, content) values ($1,$2,$3,$4)`, [crypto.randomUUID(), context.userId, "assistant", reply ?? "I could not reach the model. Try again in a moment."]);
    const all = await sql.query<{ id: string; role: string; content: string; created_at: string | Date }>(`select id, role, content, created_at from agent_messages where user_id = $1 order by created_at asc`, [context.userId]);
    return all.map((row) => ({ id: row.id, role: row.role === "assistant" ? "assistant" : "user", content: row.content, createdAt: new Date(row.created_at).toISOString() }));
  });

function mapMsg(row: { id: string; role: string; content: string; created_at: string | Date }): AgentMessage {
  return { id: row.id, role: row.role === "assistant" ? "assistant" : "user", content: row.content, createdAt: new Date(row.created_at).toISOString() };
}

async function ownedEntry(userId: string, id: string): Promise<EntryRecord> {
  const sql = await getSql();
  const rows = await sql.query<EntryRow>(`select * from entries where id = $1 and user_id = $2`, [id, userId]);
  const entry = rows[0] ? mapEntry(rows[0]) : null;
  if (!entry) throw new Error("Not found");
  return entry;
}

export const listRunMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((entryId: string) => entryId)
  .handler(async ({ context, data: entryId }): Promise<AgentMessage[]> => {
    await ownedEntry(context.userId, entryId);
    const sql = await getSql();
    const rows = await sql.query<{ id: string; role: string; content: string; created_at: string | Date }>(
      `select id, role, content, created_at from run_messages where user_id = $1 and entry_id = $2 order by created_at asc`,
      [context.userId, entryId],
    );
    return rows.map(mapMsg);
  });

export const sendRunMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { entryId: string; content: string; variables?: Record<string, string> }) => ({
    entryId: input.entryId,
    content: typeof input.content === "string" ? input.content.trim() : "",
    variables: input.variables && typeof input.variables === "object" ? input.variables : {},
  }))
  .handler(async ({ context, data }): Promise<AgentMessage[]> => {
    if (!data.content) throw new Error("Say something.");
    if (!aiAvailable()) throw new Error("AI is not available in this environment");
    const entry = await ownedEntry(context.userId, data.entryId);
    const sql = await getSql();
    await sql.query(`insert into run_messages (id, user_id, entry_id, role, content) values ($1,$2,$3,$4,$5)`, [crypto.randomUUID(), context.userId, data.entryId, "user", data.content]);
    const historyRows = await sql.query<{ role: string; content: string }>(`select role, content from run_messages where user_id = $1 and entry_id = $2 order by created_at asc`, [context.userId, data.entryId]);
    const body = applyVariables(entry.body, data.variables);
    const reply = await runEntryChat({
      kind: entry.kind,
      title: entry.title,
      body,
      history: historyRows.slice(0, -1).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      userMessage: data.content,
    });
    await sql.query(`insert into run_messages (id, user_id, entry_id, role, content) values ($1,$2,$3,$4,$5)`, [crypto.randomUUID(), context.userId, data.entryId, "assistant", reply ?? "I could not reach Grok. Try again in a moment."]);
    const all = await sql.query<{ id: string; role: string; content: string; created_at: string | Date }>(`select id, role, content, created_at from run_messages where user_id = $1 and entry_id = $2 order by created_at asc`, [context.userId, data.entryId]);
    return all.map(mapMsg);
  });

export const clearRun = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((entryId: string) => entryId)
  .handler(async ({ context, data: entryId }) => {
    await ownedEntry(context.userId, entryId);
    const sql = await getSql();
    await sql.query(`delete from run_messages where user_id = $1 and entry_id = $2`, [context.userId, entryId]);
    return { ok: true as const };
  });

export const fileRunReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { entryId: string; as: "version" | "new" }) => ({
    entryId: input.entryId,
    as: input.as === "new" ? "new" : "version",
  }))
  .handler(async ({ context, data }): Promise<{ entry: EntryRecord; as: "version" | "new" }> => {
    const current = await ownedEntry(context.userId, data.entryId);
    const sql = await getSql();
    const last = await sql.query<{ content: string }>(`select content from run_messages where user_id = $1 and entry_id = $2 and role = 'assistant' order by created_at desc limit 1`, [context.userId, data.entryId]);
    const body = last[0]?.content?.trim() ?? "";
    if (!body) throw new Error("No Grok reply to file yet.");
    if (data.as === "new") {
      const filed = await classifyCapture(body);
      const kind = filed?.kind ?? current.kind;
      const title = filed?.title || fallbackTitle(body);
      const summary = filed?.summary || body.replace(/\s+/g, " ").slice(0, 180);
      const tags = filed?.tags?.length ? filed.tags : [...current.tags];
      const phrases = filed?.semanticPhrases ?? [];
      const embedding = embedText(documentSearchText({ kind, title, summary, tags, phrases, body }));
      const id = crypto.randomUUID();
      await insertEntry(context.userId, {
        id, lineageId: id, version: 1, kind, title, body, summary, tags,
        variables: filed?.variables ?? [], phrases, embedding,
        structure: filed?.structure ?? null, isStarter: false,
      });
      const rows = await sql.query<EntryRow>(`select * from entries where id = $1 and user_id = $2`, [id, context.userId]);
      return { entry: mapEntry(rows[0]!), as: "new" };
    }
    const version = current.version + 1;
    const embedding = embedText(documentSearchText({
      kind: current.kind, title: current.title, summary: current.summary,
      tags: current.tags, phrases: current.semanticPhrases, body,
    }));
    await sql.query(`update entries set version = $1, body = $2, embedding = $3::jsonb, updated_at = now() where id = $4 and user_id = $5`, [version, body, jsonb(embedding), data.entryId, context.userId]);
    await sql.query(`insert into entry_versions (entry_id, user_id, version, kind, title, body, summary) values ($1,$2,$3,$4,$5,$6,$7)`, [data.entryId, context.userId, version, current.kind, current.title, body, current.summary]);
    const next = await sql.query<EntryRow>(`select * from entries where id = $1 and user_id = $2`, [data.entryId, context.userId]);
    return { entry: mapEntry(next[0]!), as: "version" };
  });
