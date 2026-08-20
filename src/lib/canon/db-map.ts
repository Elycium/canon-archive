import type { EntryKind, EntryRecord, FrameworkStructure } from "./types";
import { isEntryKind } from "./types";

export type EntryRow = {
  id: string;
  user_id: string;
  lineage_id: string;
  version: number;
  kind: string;
  title: string;
  body: string;
  summary: string;
  tags: unknown;
  variables: unknown;
  semantic_phrases: unknown;
  embedding: unknown;
  structure: unknown;
  starred: boolean;
  is_starter: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item is string);
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function asNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      try {
        const parsed: unknown = JSON.parse(value);
        return asNumberArray(parsed);
      } catch {
        return null;
      }
    }
    return null;
  }
  const nums = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  return nums.length ? nums : null;
}

function asStructure(value: unknown): FrameworkStructure | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  return {
    principles: asStringArray(s.principles),
    steps: asStringArray(s.steps),
    templates: asStringArray(s.templates),
    antiPatterns: asStringArray(s.antiPatterns),
  };
}

function iso(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function mapEntry(row: EntryRow): EntryRecord {
  const kind: EntryKind = isEntryKind(row.kind) ? row.kind : "prompt";
  return {
    id: row.id,
    userId: row.user_id,
    lineageId: row.lineage_id,
    version: Number(row.version),
    kind,
    title: row.title,
    body: row.body,
    summary: row.summary ?? "",
    tags: asStringArray(row.tags),
    variables: asStringArray(row.variables),
    semanticPhrases: asStringArray(row.semantic_phrases),
    embedding: asNumberArray(row.embedding),
    structure: asStructure(row.structure),
    starred: Boolean(row.starred),
    isStarter: Boolean(row.is_starter),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
