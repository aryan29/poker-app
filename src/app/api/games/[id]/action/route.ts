import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  processAction,
  advancePhase,
  determineWinner,
  calculatePots,
  serializeDeck,
  type GameStateInternal,
} from '@/lib/poker/game'
import { decodeDeck, parseCard } from '@/lib/poker/deck'
import type { ActionType } from '@/types'

export async function POST(
  request: NextRequest,
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

  let body: { action: ActionType; amount?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, amount = 0 } = body
  const validActions: ActionType[] = ['fold', 'check', 'call', 'raise', 'all_in']
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Load game from DB
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  if (game.current_player_id !== user.id) {
    return NextResponse.json({ error: 'Not your turn' }, { status: 403 })
  }

  if (game.phase === 'showdown') {
    return NextResponse.json({ error: 'Game is already in showdown' }, { status: 409 })
  }

  // Load seats and hands to reconstruct game state — use admin to read ALL players' data (bypasses RLS)
  const [{ data: seats }, { data: hands }, { data: tableConfig }] = await Promise.all([
    admin.from('table_seats').select('*').eq('table_id', game.table_id).order('seat_number', { ascending: true }),
    admin.from('player_hands').select('*').eq('game_id', gameId),
    admin.from('tables').select('small_blind, big_blind').eq('id', game.table_id).single(),
  ])

  if (!seats || !hands) {
    return NextResponse.json({ error: 'Failed to load game state' }, { status: 500 })
  }

  // Reconstruct in-memory game state
  const [deckPart, actorsPart, lastRaisePart, lastRaiserPart] = (game.deck_state ?? '').split('|')
  const deck = decodeDeck(deckPart ?? '')
  const numActorsThisRound = parseInt(actorsPart ?? '0', 10) || 0
  const lastRaiseAmount = parseInt(lastRaisePart ?? '0', 10) || (tableConfig?.big_blind ?? 20)
  const lastRaiserIndex = parseInt(lastRaiserPart ?? '-1', 10)
  if (isNaN(lastRaiserIndex)) {
    // defensive default
  }
  const state: GameStateInternal = {
    gameId,
    tableId: game.table_id,
    phase: game.phase,
    deck,
    communityCards: (game.community_cards as string[]).map(parseCard),
    pot: game.pot,
    currentBet: game.current_bet ?? 0,
    players: seats.map((seat) => {
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
    }),
    dealerSeat: game.dealer_seat,
    currentPlayerIndex: seats.findIndex((s) => s.user_id === game.current_player_id),
    smallBlind: tableConfig?.small_blind ?? 10,
    bigBlind: tableConfig?.big_blind ?? 20,
    lastRaiseAmount,
    lastRaiserIndex: isNaN(parseInt(lastRaiserPart ?? '-1', 10)) ? -1 : parseInt(lastRaiserPart ?? '-1', 10),
    sidePots: [],
    numActorsThisRound,
  }

  // Process the action in-memory
  let result
  try {
    result = processAction(state, user.id, action, amount)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const updatedState = result.state

  // Log the action (admin bypasses RLS on game_actions/player_hands/table_seats/games/tables)
  await admin.from('game_actions').insert({
    game_id: gameId,
    user_id: user.id,
    action,
    amount,
  })

  // Update the acting player's hand in DB
  const actingPlayer = updatedState.players.find((p) => p.userId === user.id)
  if (actingPlayer) {
    await admin
      .from('player_hands')
      .update({
        is_folded: actingPlayer.isFolded,
        current_bet: actingPlayer.currentBet,
        total_bet: actingPlayer.totalBet,
      })
      .eq('game_id', gameId)
      .eq('user_id', user.id)

    await admin
      .from('table_seats')
      .update({ stack: actingPlayer.stack })
      .eq('table_id', game.table_id)
      .eq('user_id', user.id)
  }

  // If only one player remains (everyone else folded), winners are embedded
  if (result.winners) {
    for (const winner of result.winners) {
      const winnerSeat = updatedState.players.find((p) => p.userId === winner.userId)
      if (winnerSeat) {
        await admin
          .from('table_seats')
          .update({ stack: winnerSeat.stack + winner.amount })
          .eq('table_id', game.table_id)
          .eq('user_id', winner.userId)
      }
    }

    await admin
      .from('games')
      .update({ phase: 'showdown', pot: 0, round_pot: 0, side_pots: [], current_player_id: null, deck_state: serializeDeck(updatedState) })
      .eq('id', gameId)

    await admin.from('tables').update({ status: 'waiting' }).eq('id', game.table_id)

    // Write hand history — Path A (early fold)
    const earlyFoldResults: Record<string, { holeCards: string[]; netChips: number; handRank: string | null }> = {}
    for (const p of updatedState.players) {
      const isWinner = result.winners.some((w: { userId: string }) => w.userId === p.userId)
      const winner = result.winners.find((w: { userId: string }) => w.userId === p.userId)
      earlyFoldResults[p.userId] = {
        holeCards: p.holeCards.map((c) => c.code),
        netChips: isWinner ? (winner?.amount ?? 0) : -p.totalBet,
        handRank: isWinner ? (winner?.handResult?.rank ?? null) : null,
      }
    }
    await admin.from('hand_history').insert({
      table_id: game.table_id,
      game_id: gameId,
      winner_user_ids: result.winners.map((w: { userId: string }) => w.userId),
      pot: updatedState.pot + updatedState.players.reduce((s, p) => s + p.currentBet, 0),
      community_cards: updatedState.communityCards.map((c) => c.code),
      player_results: earlyFoldResults,
    })

    return NextResponse.json({ game: { ...game, phase: 'showdown' }, winners: result.winners, losers: (() => {
      const winnerIds = new Set(result.winners.map((w) => w.userId))
      return updatedState.players.filter((p) => !winnerIds.has(p.userId) && p.totalBet > 0).map((p) => ({ userId: p.userId, amount: -p.totalBet }))
    })(), playerCards: (() => {
      const cards: Record<string, string[]> = {}
      updatedState.players.forEach((p) => { if (!p.isFolded) cards[p.userId] = p.holeCards.map((c) => c.code) })
      return cards
    })() })
  }

  if (result.phaseComplete) {
    const activePlayers = updatedState.players.filter((p) => !p.isFolded)
    // No one can act: all remaining players are all-in → deal the board automatically
    const allInNoAction = activePlayers.length > 1 && activePlayers.every((p) => p.isAllIn)

    if (activePlayers.length <= 1 || updatedState.phase === 'river' || allInNoAction) {
      // Auto-advance through remaining streets when all players are all-in
      let finalState = updatedState
      while (allInNoAction && finalState.phase !== 'river' && finalState.phase !== 'showdown') {
        finalState = advancePhase(finalState)
      }

      const winners = determineWinner(finalState)

      for (const winner of winners) {
        const winnerSeat = finalState.players.find((p) => p.userId === winner.userId)
        if (winnerSeat) {
          await admin
            .from('table_seats')
            .update({ stack: winnerSeat.stack + winner.amount })
            .eq('table_id', game.table_id)
            .eq('user_id', winner.userId)
        }
      }

      await admin
        .from('games')
        .update({
          phase: 'showdown',
          community_cards: finalState.communityCards.map((c) => c.code),
          pot: 0,
          round_pot: 0,
          side_pots: [],
          current_player_id: null,
          deck_state: serializeDeck(finalState),
        })
        .eq('id', gameId)

      await admin.from('tables').update({ status: 'waiting' }).eq('id', game.table_id)

      // Write hand history — Path B (full showdown)
      const winnerIds = new Set(winners.map((w) => w.userId))
      const showdownResults: Record<string, { holeCards: string[]; netChips: number; handRank: string | null }> = {}
      for (const p of finalState.players) {
        const winner = winners.find((w) => w.userId === p.userId)
        showdownResults[p.userId] = {
          holeCards: p.holeCards.map((c) => c.code),
          netChips: winner ? winner.amount : -p.totalBet,
          handRank: winner ? winner.handResult.rank : null,
        }
      }
      const totalPot = finalState.players.reduce((s, p) => s + p.totalBet, 0)
      await admin.from('hand_history').insert({
        table_id: game.table_id,
        game_id: gameId,
        winner_user_ids: winners.map((w) => w.userId),
        pot: totalPot,
        community_cards: finalState.communityCards.map((c) => c.code),
        player_results: showdownResults,
      })
      const losers = finalState.players
        .filter((p) => !winnerIds.has(p.userId) && p.totalBet > 0)
        .map((p) => ({ userId: p.userId, amount: -p.totalBet }))

      const playerCards: Record<string, string[]> = {}
      finalState.players.forEach((p) => {
        if (!p.isFolded) playerCards[p.userId] = p.holeCards.map((c) => c.code)
      })

      return NextResponse.json({ game: { ...game, phase: 'showdown' }, winners, losers, playerCards })
    }

    // Advance to next phase (flop/turn/river)
    const newState = advancePhase(updatedState)
    // Guard: ensure we never set current_player_id to a folded or all-in player
    const rawNext = newState.currentPlayerIndex >= 0 ? newState.players[newState.currentPlayerIndex] : null
    const nextPlayer = (!rawNext?.isFolded && !rawNext?.isAllIn)
      ? rawNext
      : newState.players.find((p) => !p.isFolded && !p.isAllIn) ?? null

    await admin
      .from('games')
      .update({
        phase: newState.phase,
        community_cards: newState.communityCards.map((c) => c.code),
        pot: newState.pot,
        round_pot: 0,
        side_pots: calculatePots(newState.players).length > 1 ? calculatePots(newState.players) : [],
        current_player_id: nextPlayer?.userId ?? null,
        current_bet: newState.currentBet,
        deck_state: serializeDeck(newState),
      })
      .eq('id', gameId)

    for (const p of newState.players) {
      await admin
        .from('player_hands')
        .update({ current_bet: p.currentBet })
        .eq('game_id', gameId)
        .eq('user_id', p.userId)
    }

    return NextResponse.json({
      game: {
        ...game,
        phase: newState.phase,
        community_cards: newState.communityCards.map((c) => c.code),
        pot: newState.pot,
        current_player_id: nextPlayer?.userId ?? null,
        current_bet: newState.currentBet,
      },
    })
  }

  // Advance turn within same phase
  const rawNextPlayer = updatedState.currentPlayerIndex >= 0 ? updatedState.players[updatedState.currentPlayerIndex] : null
  const nextPlayer = (!rawNextPlayer?.isFolded && !rawNextPlayer?.isAllIn)
    ? rawNextPlayer
    : updatedState.players.find((p) => !p.isFolded && !p.isAllIn) ?? null

  const roundPot = updatedState.players.reduce((s, p) => s + p.currentBet, 0)
  const sidePots = calculatePots(updatedState.players)

  await admin
    .from('games')
    .update({
      pot: updatedState.pot,
      round_pot: roundPot,
      side_pots: sidePots.length > 1 ? sidePots : [],
      current_player_id: nextPlayer?.userId ?? null,
      current_bet: updatedState.currentBet,
      deck_state: serializeDeck(updatedState),
    })
    .eq('id', gameId)

  return NextResponse.json({
    game: {
      ...game,
      pot: updatedState.pot,
      current_player_id: nextPlayer?.userId ?? null,
      current_bet: updatedState.currentBet,
    },
  })
}