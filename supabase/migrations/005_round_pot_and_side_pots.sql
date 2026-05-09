-- Track current-round bets (resets to 0 on each phase transition)
alter table public.games add column if not exists round_pot int not null default 0;

-- Computed side pots for all-in situations: [{amount, eligiblePlayers}]
alter table public.games add column if not exists side_pots jsonb not null default '[]';
