-- Move deck_state to a private table to prevent players from seeing future cards
create table if not exists public.game_decks (
  game_id uuid primary key references public.games on delete cascade,
  deck_state text not null default '',
  updated_at timestamptz default now()
);

alter table public.game_decks enable row level security;

-- Deny ALL public access. Only the service role (admin client) can read/write.
-- No SELECT, INSERT, UPDATE, or DELETE policies = denied for non-service-role users.
-- (Service role bypasses RLS entirely.)

-- Optional: clear out old deck_state values from games to remove sensitive data
update public.games set deck_state = '' where deck_state <> '';
