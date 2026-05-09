-- Add last_winners column to games table to persist hand result for display
alter table public.games add column if not exists last_winners jsonb default null;
