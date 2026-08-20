create table if not exists run_messages (
  id text primary key,
  user_id text not null,
  entry_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists run_messages_entry_idx
  on run_messages (user_id, entry_id, created_at);
