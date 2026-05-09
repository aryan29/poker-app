create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  user_id uuid references profiles,
  display_name text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Anyone reads chat" on chat_messages for select using (true);
create policy "Auth users send chat" on chat_messages for insert with check (auth.uid() = user_id);

create index chat_messages_room_code_created_at_idx on chat_messages (room_code, created_at desc);

alter publication supabase_realtime add table chat_messages;
