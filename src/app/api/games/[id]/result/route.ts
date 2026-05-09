import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  determineWinner,
  type GameStateInternal,
} from '@/lib/poker/game'
import { decodeDeck, parseCard } from '@/lib/poker/deck'

/**
 * GET /api/games/[id]/result
 * Returns the winner(s) for a completed (showdown-phase) hand.
 * Uses admin client to read all player hands (bypasses RLS).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  if (game.phase !== 'showdown') {
    return NextResponse.json({ error: 'Game not in showdown phase' }, { status: 409 })
  }

  // Use admin to bypass RLS on player_hands (so we can read all players' cards)
  const [{ data: seats }, { data: hands }] = await Promise.all([
    admin.from('table_seats').select('*').eq('table_id', game.table_id).order('seat_number', { ascending: true }),
    admin.from('player_hands').select('*').eq('game_id', gameId),
  ])

  if (!seats || !hands) {
    return NextResponse.json({ error: 'Failed to load game state' }, { status: 500 })
  }

  const { data: tableConfig } = await supabase
    .from('tables')
    .select('small_blind, big_blind')
    .eq('id', game.table_id)
    .single()

  const [deckPart, , lastRaisePart, lastRaiserPart] = (game.deck_state ?? '').split('|')
  const deck = decodeDeck(deckPart ?? '')
  const lastRaiseAmount = parseInt(lastRaisePart ?? '0', 10) || (tableConfig?.big_blind ?? 20)

  const players = seats.map((seat) => {
    const hand = hands.find((h) => h.user_id === seat.user_id)
    return {
      userId: seat.user_id,
      seatNumber: seat.seat_number,
      stack: seat.stack,
      holeCards: ((hand?.hole_cards ?? []) as string[]).map(parseCard),
      isFolded: hand?.is_folded ?? false,
      isAllIn: seat.stack === 0 && !(hand?.is_folded),
      currentBet: hand?.current_bet ?? 0,
      totalBet: hand?.total_bet ?? 0,
    }
  })

  // Reconstruct the pot from total bets (pot is 0 in DB post-showdown)
  const reconstructedPot = players.reduce((sum, p) => sum + p.totalBet, 0)

  const state: GameStateInternal = {
    gameId,
    tableId: game.table_id,
    phase: 'river',
    deck,
    communityCards: (game.community_cards as string[]).map(parseCard),
    pot: reconstructedPot,
    currentBet: game.current_bet ?? 0,
    players,
    dealerSeat: game.dealer_seat,
    currentPlayerIndex: 0,
    smallBlind: tableConfig?.small_blind ?? 10,
    bigBlind: tableConfig?.big_blind ?? 20,
    lastRaiseAmount,
    lastRaiserIndex: isNaN(parseInt(lastRaiserPart ?? '-1', 10)) ? -1 : parseInt(lastRaiserPart ?? '-1', 10),
    sidePots: [],
    numActorsThisRound: 0,
  }

  const winners = determineWinner(state)
  const winnerIds = new Set(winners.map((w) => w.userId))

  const losers = players
    .filter((p) => !winnerIds.has(p.userId) && p.totalBet > 0)
    .map((p) => ({ userId: p.userId, amount: -p.totalBet }))

  // Reveal hole cards for all non-folded players
  const playerCards: Record<string, string[]> = {}
  players.forEach((p) => {
    if (!p.isFolded && p.holeCards.length > 0) {
      playerCards[p.userId] = p.holeCards.map((c) => c.code)
    }
  })

  return NextResponse.json({ winners, losers, playerCards })
}
