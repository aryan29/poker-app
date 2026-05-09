import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DEBUG ROUTE: proves a regular signed-in player CANNOT read the poker deck.
 *
 * This route deliberately uses the SERVER (user-context) Supabase client — NOT
 * the admin/service-role client. So whatever it returns is exactly what a
 * regular signed-in player would see if they queried Supabase from the browser.
 *
 * Used by tests/deck-security.spec.ts to assert:
 *   1. games.deck_state column is empty for any games visible to the user
 *      (the sensitive data has been moved out / cleared by migration 007).
 *   2. game_decks table returns either an RLS error or zero rows
 *      (no public RLS policy, so non-service-role users get nothing).
 *
 * Safe to leave in production — it returns only metadata; if the security
 * contract holds, no card data ever escapes via this endpoint.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('id, deck_state')
    .limit(20)

  const { data: decks, error: dErr } = await supabase
    .from('game_decks')
    .select('game_id, deck_state')
    .limit(20)

  return NextResponse.json({
    games: { rows: games ?? [], error: gErr?.message ?? null },
    game_decks: { rows: decks ?? [], error: dErr?.message ?? null },
  })
}
