/** Feature-hashed embeddings for personal-library semantic search (no pgvector). */

export const EMBED_DIMS = 256;

const STOP = new Set([
  "a","an","the","and","or","of","to","in","for","on","with","by","at","from","as","is","it",
  "this","that","be","are","was","were","you","your","my","me","we","our","i","im","ive","dont",
  "do","does","did","not","no","so","if","then","than","too","very","just","about","into","over",
  "after","before","also","can","will","would","should","could","may","might","use","using","used",
  "make","made","get","got","how","what","when","where","which","who","why",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function hashToken(token: string): number {
  let h = 5381;
  for (let i = 0; i < token.length; i += 1) {
    h = ((h << 5) + h) ^ token.charCodeAt(i);
  }
  return (h >>> 0) % EMBED_DIMS;
}

export function embedText(text: string): number[] {
  const vec = new Float64Array(EMBED_DIMS);
  const tokens = tokenize(text);
  if (tokens.length === 0) return Array.from(vec);
  for (let i = 0; i < tokens.length; i += 1) {
    vec[hashToken(tokens[i])] += 1;
    if (i + 1 < tokens.length) {
      vec[hashToken(`${tokens[i]}_${tokens[i + 1]}`)] += 1.5;
    }
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIMS; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(EMBED_DIMS);
  for (let i = 0; i < EMBED_DIMS; i += 1) out[i] = vec[i] / norm;
  return out;
}

export function cosine(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

export function documentSearchText(input: {
  kind: string;
  title: string;
  summary: string;
  tags: string[];
  phrases: string[];
  body: string;
}): string {
  return [
    input.kind,
    input.title,
    input.summary,
    input.tags.join(" "),
    input.phrases.join("\n"),
    input.body.slice(0, 2800),
  ]
    .filter(Boolean)
    .join("\n");
}

export function lexicalScore(
  query: string,
  doc: {
    title: string;
    summary: string;
    body: string;
    tags: string[];
    phrases: string[];
  },
): { score: number; reasons: string[] } {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return { score: 0, reasons: [] };
  const title = doc.title.toLowerCase();
  const summary = doc.summary.toLowerCase();
  const tags = doc.tags.map((t) => t.toLowerCase());
  const phrases = doc.phrases.map((p) => p.toLowerCase());
  const body = doc.body.slice(0, 2400).toLowerCase();
  const reasons: string[] = [];
  let weighted = 0;
  let hits = 0;
  for (const t of qTokens) {
    let hit = false;
    if (title.includes(t)) {
      weighted += 2.2;
      hit = true;
      if (reasons.length < 3 && !reasons.includes("title")) reasons.push("title");
    }
    if (tags.some((tag) => tag.includes(t) || t.includes(tag))) {
      weighted += 1.6;
      hit = true;
      if (reasons.length < 3 && !reasons.includes("tag")) reasons.push("tag");
    }
    const phraseHit = phrases.find((p) => p.includes(t));
    if (phraseHit) {
      weighted += 1.8;
      hit = true;
      if (reasons.length < 4) reasons.push(phraseHit);
    }
    if (summary.includes(t)) {
      weighted += 1.1;
      hit = true;
    }
    if (body.includes(t)) {
      weighted += 0.5;
      hit = true;
    }
    if (hit) hits += 1;
  }
  const coverage = hits / qTokens.length;
  const score = Math.min(1, coverage * 0.55 + (weighted / (qTokens.length * 2.2)) * 0.45);
  return { score, reasons };
}

export function hybridScore(cosineSim: number, lexical: number): number {
  const c = Math.max(0, cosineSim);
  return 0.68 * c + 0.32 * lexical;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 240);
}
