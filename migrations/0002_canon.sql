-- Canon: per-user prompt / system / framework archive with semantic search index
create table if not exists entries (
  id text primary key,
  user_id text not null,
  lineage_id text not null,
  version integer not null default 1,
  kind text not null,
  title text not null,
  body text not null,
  summary text not null default '',
  tags jsonb not null default '[]',
  variables jsonb not null default '[]',
  semantic_phrases jsonb not null default '[]',
  embedding jsonb,
  structure jsonb,
  starred boolean not null default false,
  is_starter boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_updated_idx on entries (user_id, updated_at desc);
create index if not exists entries_user_kind_idx on entries (user_id, kind);
create index if not exists entries_user_lineage_idx on entries (user_id, lineage_id);

create table if not exists entry_versions (
  id serial primary key,
  entry_id text not null,
  user_id text not null,
  version integer not null,
  kind text not null,
  title text not null,
  body text not null,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists entry_versions_entry_idx on entry_versions (entry_id, version desc);

create table if not exists canon_docs (
  id text primary key,
  user_id text not null,
  version integer not null default 1,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists canon_docs_user_idx on canon_docs (user_id, version desc);

create table if not exists agent_messages (
  id text primary key,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_user_idx on agent_messages (user_id, created_at asc);

create table if not exists search_expansions (
  user_id text not null,
  query_norm text not null,
  terms jsonb not null,
  intent text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, query_norm)
);
