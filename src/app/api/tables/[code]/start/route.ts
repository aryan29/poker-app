import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startHand, serializeDeck } from '@/lib/poker/game'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch table with seats
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('*, table_seats(*)')
    .eq('room_code', code.toUpperCase())
    .order('seat_number', { referencedTable: 'table_seats', ascending: true })
    .single()

  if (tableError || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  if (table.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 })
  }

  if (table.status === 'playing') {
    return NextResponse.json({ error: 'Game already in progress' }, { status: 409 })
  }

  const seats = (table.table_seats ?? []) as Array<{
    user_id: string
    seat_number: number
    stack: number
  }>

  if (seats.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 })
  }

  const dealerSeat = seats[0].seat_number

  // Build in-memory game state (shuffles deck, deals cards, posts blinds)
  const gameState = startHand(
    '',
    table.id,
    seats.map((s) => ({ userId: s.user_id, seatNumber: s.seat_number, stack: s.stack })),
    dealerSeat,
    table.small_blind,
    table.big_blind
  )

  // Persist game record (use admin to bypass RLS on games table)
  const { data: game, error: gameError } = await admin
    .from('games')
    .insert({
      table_id: table.id,
      phase: 'preflop',
      community_cards: [],
      pot: gameState.pot,
      round_pot: gameState.players.reduce((s, p) => s + p.currentBet, 0),
      side_pots: [],
      current_player_id: gameState.players[gameState.currentPlayerIndex].userId,
      dealer_seat: dealerSeat,
      deck_state: serializeDeck(gameState),
      current_bet: gameState.currentBet,
    })
    .select()
    .single()

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message ?? 'Failed to create game' }, { status: 500 })
  }

  // Persist player hands (hole cards)
  await admin.from('player_hands').insert(
    gameState.players.map((p) => ({
      game_id: game.id,
      user_id: p.userId,
      hole_cards: p.holeCards.map((c) => c.code),
      is_folded: false,
      current_bet: p.currentBet,
      total_bet: p.totalBet,
    }))
  )

  // Update seat stacks after blind posting
  for (const p of gameState.players) {
    await admin
      .from('table_seats')
      .update({ stack: p.stack })
      .eq('table_id', table.id)
      .eq('user_id', p.userId)
  }

  // Mark table as playing
  await admin.from('tables').update({ status: 'playing' }).eq('id', table.id)

  return NextResponse.json({ game }, { status: 201 })
}
