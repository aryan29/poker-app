import type { Card, ActionType, WinnerResult, GamePhase } from '@/types'
import { createShuffledDeck, encodeDeck, decodeDeck } from './deck'
import { findWinners } from './evaluator'

// ─── Internal State Types ─────────────────────────────────────────────────────

export interface PlayerState {
  userId: string
  seatNumber: number
  stack: number
  holeCards: Card[]
  isFolded: boolean
  isAllIn: boolean
  currentBet: number
  totalBet: number
}

export interface GameStateInternal {
  gameId: string
  tableId: string
  phase: GamePhase
  deck: Card[]
  communityCards: Card[]
  pot: number
  currentBet: number
  players: PlayerState[]
  dealerSeat: number
  currentPlayerIndex: number
  smallBlind: number
  bigBlind: number
  lastRaiseAmount: number
  lastRaiserIndex: number
  sidePots: Array<{ amount: number; eligiblePlayers: string[] }>
  numActorsThisRound: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlayersBySeatOrder(
  players: PlayerState[],
  startAfterSeat: number
): PlayerState[] {
  const sorted = [...players].sort((a, b) => a.seatNumber - b.seatNumber)
  const pivot = sorted.findIndex((p) => p.seatNumber > startAfterSeat)
  if (pivot === -1) return sorted
  return [...sorted.slice(pivot), ...sorted.slice(0, pivot)]
}

function getNextActiveIndex(state: GameStateInternal, afterSeat: number): number {
  const ordered = getPlayersBySeatOrder(state.players, afterSeat)
  const next = ordered.find((p) => !p.isFolded && !p.isAllIn)
  if (!next) return state.currentPlayerIndex
  return state.players.findIndex((p) => p.userId === next.userId)
}

function postBlind(state: GameStateInternal, playerIndex: number, amount: number) {
  const player = state.players[playerIndex]
  const actual = Math.min(amount, player.stack)
  player.stack -= actual
  player.currentBet = actual
  player.totalBet += actual
  state.pot += actual
  if (player.stack === 0) player.isAllIn = true
}

function resetBettingRound(state: GameStateInternal) {
  for (const p of state.players) {
    p.currentBet = 0
  }
  state.currentBet = 0
  state.lastRaiseAmount = state.bigBlind
  state.lastRaiserIndex = -1
  state.numActorsThisRound = 0
  state.currentPlayerIndex = getNextActiveIndex(state, state.dealerSeat)
}

function isBettingRoundComplete(state: GameStateInternal): boolean {
  const active = state.players.filter((p) => !p.isFolded && !p.isAllIn)
  // Round is only auto-complete when nobody can act (all folded or all-in)
  if (active.length === 0) return true
  const maxBet = Math.max(...state.players.map((p) => p.currentBet))
  const betsEqual = active.every((p) => p.currentBet === maxBet)
  // Every active player must have acted at least once this round
  return betsEqual && state.numActorsThisRound >= active.length
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findNextPlayerIndex(state: GameStateInternal, currentIndex: number): number {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n
    const p = state.players[idx]
    if (!p.isFolded && !p.isAllIn) return idx
  }
  return currentIndex
}

// ─── startHand ────────────────────────────────────────────────────────────────

/**
 * Synchronous in-memory hand initialisation.
 * Shuffles deck, deals 2 hole cards per player, posts blinds.
 * Returns GameStateInternal — caller must persist to DB.
 */
export function startHand(
  gameId: string,
  tableId: string,
  players: Array<{ userId: string; seatNumber: number; stack: number }>,
  dealerSeat: number,
  smallBlind: number,
  bigBlind: number
): GameStateInternal {
  const deck = createShuffledDeck()

  const playerStates: PlayerState[] = players.map((p) => ({
    userId: p.userId,
    seatNumber: p.seatNumber,
    stack: p.stack,
    holeCards: [],
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBet: 0,
  }))

  const state: GameStateInternal = {
    gameId,
    tableId,
    phase: 'preflop',
    deck,
    communityCards: [],
    pot: 0,
    currentBet: bigBlind,
    players: playerStates,
    dealerSeat,
    currentPlayerIndex: 0,
    smallBlind,
    bigBlind,
    lastRaiseAmount: bigBlind,
    lastRaiserIndex: -1,
    sidePots: [],
    numActorsThisRound: 0,
  }

  // Post blinds
  const sbIndex = getNextActiveIndex(state, dealerSeat)
  const bbIndex = getNextActiveIndex(state, playerStates[sbIndex].seatNumber)
  postBlind(state, sbIndex, smallBlind)
  postBlind(state, bbIndex, bigBlind)
  state.lastRaiserIndex = bbIndex

  // Deal 2 hole cards per player in seat order starting after dealer
  for (let round = 0; round < 2; round++) {
    const ordered = getPlayersBySeatOrder(playerStates, dealerSeat)
    for (const player of ordered) {
      const card = deck.pop()!
      player.holeCards.push(card)
    }
  }

  // First to act: UTG (left of BB)
  state.currentPlayerIndex = getNextActiveIndex(state, playerStates[bbIndex].seatNumber)

  return state
}

// ─── processAction ────────────────────────────────────────────────────────────

export interface ActionResult {
  state: GameStateInternal
  phaseComplete: boolean
  winners?: WinnerResult[]
}

/**
 * Validate and apply a player action in-memory.
 * Returns ActionResult — caller must persist changes to DB.
 */
export function processAction(
  state: GameStateInternal,
  userId: string,
  action: ActionType | string,
  amount = 0
): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.userId === userId)
  if (playerIndex !== state.currentPlayerIndex) {
    throw new Error("Not this player's turn")
  }

  const player = state.players[playerIndex]
  const maxBet = Math.max(...state.players.map((p) => p.currentBet))
  const callAmount = maxBet - player.currentBet

  switch (action) {
    case 'fold': {
      player.isFolded = true
      // Fold does NOT count as a betting action — remaining players still get their turns
      break
    }
    case 'check': {
      if (callAmount > 0) throw new Error('Cannot check — there is a bet to call')
      break
    }
    case 'call': {
      const actual = Math.min(callAmount, player.stack)
      player.stack -= actual
      player.currentBet += actual
      player.totalBet += actual
      state.pot += actual
      if (player.stack === 0) player.isAllIn = true
      break
    }
    case 'raise': {
      // Minimum raise = the previous raise increment added on top of the current max bet
      const minRaiseTotal = maxBet + state.lastRaiseAmount
      if (amount < minRaiseTotal) {
        throw new Error(`Minimum raise is ${minRaiseTotal}`)
      }
      const toAdd = Math.min(amount - player.currentBet, player.stack)
      player.stack -= toAdd
      state.lastRaiseAmount = toAdd - callAmount
      player.currentBet += toAdd
      player.totalBet += toAdd
      state.pot += toAdd
      state.currentBet = player.currentBet
      state.lastRaiserIndex = playerIndex
      if (player.stack === 0) player.isAllIn = true
      break
    }
    case 'all-in':
    case 'all_in': {
      const allInAmount = player.stack
      player.currentBet += allInAmount
      player.totalBet += allInAmount
      state.pot += allInAmount
      player.stack = 0
      player.isAllIn = true
      if (player.currentBet > maxBet) {
        state.lastRaiseAmount = player.currentBet - maxBet
        state.lastRaiserIndex = playerIndex
        state.currentBet = player.currentBet
      }
      break
    }
    default:
      throw new Error(`Unknown action: ${action}`)
  }

  // Check if only one non-folded player remains
  const nonFolded = state.players.filter((p) => !p.isFolded)
  if (nonFolded.length === 1) {
    const winners = determineWinner(state)
    return { state, phaseComplete: true, winners }
  }

  // Advance to next active player using seat order
  const nextIndex = getNextActiveIndex(state, state.players[playerIndex].seatNumber)
  state.currentPlayerIndex = nextIndex

  // Folds do not count as a betting action (already handled — we skip the increment for folds)
  if (action !== 'fold') {
    state.numActorsThisRound += 1
  }

  if (isBettingRoundComplete(state)) {
    return { state, phaseComplete: true }
  }

  return { state, phaseComplete: false }
}

// ─── Phase advancement ────────────────────────────────────────────────────────

/** preflop → flop: burn 1, deal 3 community cards */
export function dealFlop(state: GameStateInternal): GameStateInternal {
  if (state.phase !== 'preflop') throw new Error('Not in preflop phase')
  state.deck.pop()
  state.communityCards.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!)
  state.phase = 'flop'
  resetBettingRound(state)
  return state
}

/** flop → turn: burn 1, deal 1 community card */
export function dealTurn(state: GameStateInternal): GameStateInternal {
  if (state.phase !== 'flop') throw new Error('Not in flop phase')
  state.deck.pop()
  state.communityCards.push(state.deck.pop()!)
  state.phase = 'turn'
  resetBettingRound(state)
  return state
}

/** turn → river: burn 1, deal 1 community card */
export function dealRiver(state: GameStateInternal): GameStateInternal {
  if (state.phase !== 'turn') throw new Error('Not in turn phase')
  state.deck.pop()
  state.communityCards.push(state.deck.pop()!)
  state.phase = 'river'
  resetBettingRound(state)
  return state
}

/** Advance phase: preflop→flop→turn→river */
export function advancePhase(state: GameStateInternal): GameStateInternal {
  if (state.phase === 'preflop') return dealFlop(state)
  if (state.phase === 'flop') return dealTurn(state)
  if (state.phase === 'turn') return dealRiver(state)
  throw new Error(`Cannot advance from phase: ${state.phase}`)
}

// ─── determineWinner ──────────────────────────────────────────────────────────

/**
 * Evaluate all non-folded hands and return winner(s) with pot amounts.
 * Does NOT write to DB — caller must persist.
 */
export function determineWinner(state: GameStateInternal): WinnerResult[] {
  const activePlayers = state.players.filter((p) => !p.isFolded)

  if (activePlayers.length === 1) {
    return [
      {
        userId: activePlayers[0].userId,
        handResult: {
          rank: 'high-card',
          rankValue: 1,
          tiebreakers: [],
          cards: [],
          description: 'Last player standing',
        },
        amount: state.pot,
      },
    ]
  }

  const hands = activePlayers.map((p) => ({
    userId: p.userId,
    cards: [...p.holeCards, ...state.communityCards].map((c) => c.code),
  }))

  const winners = findWinners(hands)
  const amountEach = Math.floor(state.pot / winners.length)

  return winners.map((w) => ({
    userId: w.userId,
    handResult: w.handResult,
    amount: amountEach,
  }))
}

// ─── Serialization ────────────────────────────────────────────────────────────

/** Encode deck state to a storable string */
export function serializeDeck(state: GameStateInternal): string {
  return (
    encodeDeck(state.deck) +
    '|' + (state.numActorsThisRound ?? 0) +
    '|' + (state.lastRaiseAmount ?? state.bigBlind) +
    '|' + (state.lastRaiserIndex ?? -1)
  )
}

/** Decode a stored deck string back to Card objects */
export function deserializeDeck(deckStr: string): Card[] {
  return decodeDeck(deckStr)
}
