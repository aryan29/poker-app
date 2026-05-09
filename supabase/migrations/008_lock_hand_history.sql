-- hand_history.player_results contains hole cards for ALL players, including
-- folded players who never revealed at showdown. Previously this table was
-- publicly readable, leaking folded hole cards.
-- Lock it down: only the service role (admin client) can read. The
-- /api/tables/[code]/history endpoint fetches via admin and filters
-- per-requestor before returning.
drop policy if exists "Anyone reads hand history" on public.hand_history;
-- No SELECT policy = denied for non-service-role users.

notify pgrst, 'reload schema';
