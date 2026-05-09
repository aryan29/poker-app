create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  chip_balance bigint not null default 10000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles viewable" on profiles for select using (true);
create policy "Own profile updatable" on profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_id uuid references profiles,
  status text not null default 'waiting',
  small_blind int not null default 10,
  big_blind int not null default 20,
  min_buyin int not null default 200,
  max_buyin int not null default 1000,
  max_players int not null default 9,
  created_at timestamptz default now()
);
alter table public.tables enable row level security;
create policy "Anyone views tables" on tables for select using (true);
create policy "Auth users create tables" on tables for insert with check (auth.uid() = host_id);
create policy "Host updates table" on tables for update using (auth.uid() = host_id);

create table public.table_seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables on delete cascade,
  user_id uuid references profiles,
  seat_number int not null,
  stack int not null,
  status text not null default 'active',
  unique(table_id, seat_number),
  unique(table_id, user_id)
);
alter table public.table_seats enable row level security;
create policy "Anyone views seats" on table_seats for select using (true);
create policy "Users join seats" on table_seats for insert with check (auth.uid() = user_id);
create policy "Users update own seat" on table_seats for update using (auth.uid() = user_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables on delete cascade,
  phase text not null default 'preflop',
  community_cards text[] default '{}',
  pot int not null default 0,
  current_player_id uuid references profiles,
  dealer_seat int not null default 0,
  deck_state text not null default '',
  current_bet int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.games enable row level security;
create policy "Players view game" on games for select using (true);
create policy "Service updates game" on games for update using (true);

create table public.player_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games on delete cascade,
  user_id uuid references profiles,
  hole_cards text[] not null,
  is_folded bool default false,
  current_bet int default 0,
  total_bet int default 0
);
alter table public.player_hands enable row level security;
create policy "Own hand only" on player_hands for select using (auth.uid() = user_id);
create policy "Insert hands" on player_hands for insert with check (true);
create policy "Update hands" on player_hands for update using (true);

create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games on delete cascade,
  user_id uuid references profiles,
  action text not null,
  amount int default 0,
  created_at timestamptz default now()
);
alter table public.game_actions enable row level security;
create policy "View actions" on game_actions for select using (true);
create policy "Insert own actions" on game_actions for insert with check (auth.uid() = user_id);

alter publication supabase_realtime add table tables;
alter publication supabase_realtime add table table_seats;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_actions;
