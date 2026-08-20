export const ENTRY_KINDS = ["prompt", "system", "framework"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const SEARCH_MODES = ["semantic", "exact"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export type FrameworkStructure = {
  principles: string[];
  steps: string[];
  templates: string[];
  antiPatterns: string[];
};

export type EntryRecord = {
  id: string;
  userId: string;
  lineageId: string;
  version: number;
  kind: EntryKind;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  variables: string[];
  semanticPhrases: string[];
  embedding: number[] | null;
  structure: FrameworkStructure | null;
  starred: boolean;
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LibraryHit = {
  id: string;
  kind: EntryKind;
  title: string;
  summary: string;
  tags: string[];
  starred: boolean;
  isStarter: boolean;
  version: number;
  updatedAt: string;
  score: number;
  reasons: string[];
};

export type EntryVersion = {
  version: number;
  title: string;
  summary: string;
  createdAt: string;
};

export type CanonDoc = {
  id: string;
  version: number;
  body: string;
  createdAt: string;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type CaptureResult = {
  entry: EntryRecord;
  filedByAi: boolean;
};

export function isEntryKind(value: string): value is EntryKind {
  return (ENTRY_KINDS as readonly string[]).includes(value);
}

export function isSearchMode(value: string): value is SearchMode {
  return (SEARCH_MODES as readonly string[]).includes(value);
}
