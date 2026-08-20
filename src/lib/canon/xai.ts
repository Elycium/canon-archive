import type { EntryKind, FrameworkStructure } from "./types";
import { isEntryKind } from "./types";

const MODEL = "grok-4.5";
const BASE = "https://api.x.ai/v1/chat/completions";

export type CaptureAi = {
  kind: EntryKind;
  title: string;
  summary: string;
  tags: string[];
  variables: string[];
  semanticPhrases: string[];
  structure: FrameworkStructure | null;
  relatedTitleGuess: string;
  canonNote: string;
};

export type QueryExpansion = {
  terms: string[];
  intent: string;
};

function apiKey(): string | null {
  const key = process.env.XAI_API_KEY;
  return key && key.trim() ? key : null;
}

export function aiAvailable(): boolean {
  return Boolean(apiKey());
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const value: unknown = JSON.parse(trimmed);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const value: unknown = JSON.parse(match[0]);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return value as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function asStringArray(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

async function chat(opts: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens: number;
  json?: boolean;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = apiKey();
  if (!key) return { ok: false, error: "AI is not available" };
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: 0.2,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  return { ok: true, text };
}

export async function classifyCapture(body: string): Promise<CaptureAi | null> {
  const result = await chat({
    json: true,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You file items into a personal archive of prompts, system prompts, and frameworks. Return JSON only.",
      },
      {
        role: "user",
        content: `Classify and index this capture for semantic search.\n\nkind: "prompt" (a user-facing instruction), "system" (role/rules/constitution for a model), or "framework" (a reusable method with steps/principles).\n\nReturn JSON:\n{\n  "kind": "prompt" | "system" | "framework",\n  "title": "short title, max 72 chars, no quotes",\n  "summary": "one sentence, max 220 chars",\n  "tags": ["3 to 8 lowercase tags"],\n  "variables": ["{names} or {{names}} found or implied"],\n  "semanticPhrases": ["12 to 24 phrases a person might search that should retrieve this — synonyms, intents, jobs-to-be-done, related jargon. Not a restatement of the title only."],\n  "structure": { "principles": [], "steps": [], "templates": [], "antiPatterns": [] } or null if not a framework,\n  "relatedTitleGuess": "title of an existing piece this might revise, or empty",\n  "canonNote": "one sentence on how this changes the author's house style, or empty"\n}\n\nCapture:\n${body.slice(0, 8000)}`,
      },
    ],
  });
  if (!result.ok) return null;
  const json = parseJsonObject(result.text);
  if (!json) return null;
  const kindRaw = typeof json.kind === "string" ? json.kind : "prompt";
  const kind: EntryKind = isEntryKind(kindRaw) ? kindRaw : "prompt";
  const structureRaw = json.structure;
  let structure: FrameworkStructure | null = null;
  if (structureRaw && typeof structureRaw === "object" && !Array.isArray(structureRaw)) {
    const s = structureRaw as Record<string, unknown>;
    structure = {
      principles: asStringArray(s.principles, 12),
      steps: asStringArray(s.steps, 12),
      templates: asStringArray(s.templates, 8),
      antiPatterns: asStringArray(s.antiPatterns, 8),
    };
  }
  return {
    kind,
    title: (typeof json.title === "string" && json.title.trim()) || "Untitled capture",
    summary: typeof json.summary === "string" ? json.summary.trim().slice(0, 280) : "",
    tags: asStringArray(json.tags, 8),
    variables: asStringArray(json.variables, 16),
    semanticPhrases: asStringArray(json.semanticPhrases, 24),
    structure,
    relatedTitleGuess: typeof json.relatedTitleGuess === "string" ? json.relatedTitleGuess.trim() : "",
    canonNote: typeof json.canonNote === "string" ? json.canonNote.trim() : "",
  };
}

export async function expandSearchQuery(query: string): Promise<QueryExpansion | null> {
  const result = await chat({
    json: true,
    maxTokens: 280,
    messages: [
      {
        role: "system",
        content:
          "You expand library search queries for a prompt/system-prompt/framework archive. JSON only.",
      },
      {
        role: "user",
        content: `Expand this search for semantic retrieval.\nQuery: ${query.slice(0, 400)}\n\nReturn JSON:\n{\n  "intent": "one line, what they want to find",\n  "terms": ["8 to 16 synonyms, related jobs, jargon, neighboring concepts — not the original words repeated"]\n}`,
      },
    ],
  });
  if (!result.ok) return null;
  const json = parseJsonObject(result.text);
  if (!json) return null;
  return {
    intent: typeof json.intent === "string" ? json.intent.trim() : "",
    terms: asStringArray(json.terms, 16),
  };
}

export async function rebuildCanonDocument(
  catalog: { kind: string; title: string; summary: string; tags: string[] }[],
): Promise<string | null> {
  const list = catalog
    .slice(0, 80)
    .map(
      (item, i) =>
        `${i + 1}. [${item.kind}] ${item.title} — ${item.summary} (${item.tags.join(", ")})`,
    )
    .join("\n");
  const result = await chat({
    maxTokens: 1400,
    messages: [
      {
        role: "system",
        content:
          "You distill a living house style from a personal archive of prompts, system prompts, and frameworks. Write markdown. No preamble.",
      },
      {
        role: "user",
        content: `Write the author's Canon — a living document of how they instruct machines, inferred only from the catalog.\n\nSections:\n# Canon\n## House style\n## Recurring roles\n## Constraints they insist on\n## Frameworks in play\n## Gaps\n\nCatalog:\n${list || "(empty library)"}`,
      },
    ],
  });
  if (!result.ok) return null;
  return result.text.trim() || null;
}

export function applyVariables(body: string, values: Record<string, string>): string {
  let out = body;
  for (const [rawKey, value] of Object.entries(values)) {
    const key = rawKey.replace(/^\{\{?/, "").replace(/\}\}?$/, "").trim();
    if (!key || !value) continue;
    out = out.split(`{{${key}}}`).join(value).split(`{${key}}`).join(value);
  }
  return out;
}

export function liveSystemPrompt(input: {
  kind: EntryKind;
  title: string;
  body: string;
}): string {
  const piece = input.body.slice(0, 12000);
  if (input.kind === "system") return piece;
  if (input.kind === "framework") {
    return `You are executing the framework "${input.title}". Follow its steps, principles, and constraints. Do not drop them.\n\n${piece}`;
  }
  return `You are executing the prompt "${input.title}". Stay faithful to its instructions and output contract.\n\n${piece}`;
}

export async function runEntryChat(input: {
  kind: EntryKind;
  title: string;
  body: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<string | null> {
  const history = input.history.slice(-12).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 4000),
  }));
  const result = await chat({
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: liveSystemPrompt({
          kind: input.kind,
          title: input.title,
          body: input.body,
        }),
      },
      ...history,
      { role: "user", content: input.userMessage.slice(0, 4000) },
    ],
  });
  if (!result.ok) return null;
  return result.text.trim() || null;
}

export async function agentReply(input: {
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  catalog: { id: string; kind: string; title: string; summary: string; tags: string[] }[];
  canonExcerpt: string;
}): Promise<string | null> {
  const catalog = input.catalog
    .slice(0, 50)
    .map(
      (item) =>
        `- (${item.id}) [${item.kind}] ${item.title} — ${item.summary} [${item.tags.join(", ")}]`,
    )
    .join("\n");
  const history = input.history.slice(-8).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 4000),
  }));
  const result = await chat({
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content: `You are the Canon agent. You only talk about this author's archive of prompts, system prompts, and frameworks. Cite pieces by title. If the library has nothing relevant, say so and offer to capture something. Be concise.\n\nLiving Canon:\n${input.canonExcerpt.slice(0, 3000) || "(not built yet)"}\n\nLibrary:\n${catalog || "(empty)"}`,
      },
      ...history,
      { role: "user", content: input.question.slice(0, 4000) },
    ],
  });
  if (!result.ok) return null;
  return result.text.trim() || null;
}
