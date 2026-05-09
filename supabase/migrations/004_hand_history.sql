create table public.hand_history (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables on delete cascade,
  game_id uuid references games on delete cascade,
  winner_user_ids text[] not null default '{}',
  pot int not null default 0,
  community_cards text[] not null default '{}',
  player_results jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.hand_history enable row level security;
create policy "Anyone reads hand history" on hand_history for select using (true);
create policy "Service inserts hand history" on hand_history for insert with check (true);
create index hand_history_table_id_idx on hand_history (table_id, created_at desc);
