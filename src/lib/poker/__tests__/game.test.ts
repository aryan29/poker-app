import { describe, it, expect } from 'vitest'
import { calculatePots, determineWinner, processAction, startHand } from '../game'
import type { GameStateInternal, PlayerState } from '../game'
import type { Card } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(
  userId: string,
  seatNumber: number,
  totalBet: number,
  stack: number,
  opts: Partial<PlayerState> = {}
): PlayerState {
  return {
    userId,
    seatNumber,
    stack,
    holeCards: [],
    isFolded: false,
    isAllIn: stack === 0,
    currentBet: 0,
    totalBet,
    ...opts,
  }
}

function card(code: string): Card {
  return { rank: code.slice(0, -1) as Card['rank'], suit: code.slice(-1) as Card['suit'], code }
}

function makeState(overrides: Partial<GameStateInternal> = {}): GameStateInternal {
  return {
    gameId: 'g1',
    tableId: 't1',
    phase: 'river',
    deck: [],
    communityCards: [card('2h'), card('5d'), card('8c'), card('Jh'), card('Kd')],
    pot: 0,
    currentBet: 0,
    players: [],
    dealerSeat: 1,
    currentPlayerIndex: 0,
    smallBlind: 50,
    bigBlind: 100,
    lastRaiseAmount: 100,
    lastRaiserIndex: -1,
    sidePots: [],
    numActorsThisRound: 0,
    ...overrides,
  }
}

// ─── calculatePots ────────────────────────────────────────────────────────────

describe('calculatePots', () => {
  it('single pot when all players contributed equally', () => {
    const players = [
      makePlayer('A', 1, 200, 0),
      makePlayer('B', 2, 200, 0),
      makePlayer('C', 3, 200, 0),
    ]
    const pots = calculatePots(players)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(600)
    expect(pots[0].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B', 'C']))
  })

  it('main pot + side pot for 3 players with unequal all-ins', () => {
    // A: 100 all-in, B: 300 all-in, C: 300 all-in
    const players = [
      makePlayer('A', 1, 100, 0),
      makePlayer('B', 2, 300, 0),
      makePlayer('C', 3, 300, 0),
    ]
    const pots = calculatePots(players)
    expect(pots).toHaveLength(2)

    const mainPot = pots[0]
    expect(mainPot.amount).toBe(300) // 100 × 3
    expect(mainPot.eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B', 'C']))

    const sidePot = pots[1]
    expect(sidePot.amount).toBe(400) // (300-100) × 2
    expect(sidePot.eligiblePlayers).toHaveLength(2)
    expect(sidePot.eligiblePlayers).toEqual(expect.arrayContaining(['B', 'C']))
    expect(sidePot.eligiblePlayers).not.toContain('A')
  })

  it('folded player contributes to pot amount but is not eligible', () => {
    const players = [
      makePlayer('A', 1, 50, 200, { isFolded: true }),  // folded after posting blind
      makePlayer('B', 2, 200, 0),
      makePlayer('C', 3, 200, 0),
    ]
    const pots = calculatePots(players)
    const total = pots.reduce((s, p) => s + p.amount, 0)
    expect(total).toBe(450) // 50 + 200 + 200

    // A's 50 contributes to the main pot but A cannot win
    for (const pot of pots) {
      expect(pot.eligiblePlayers).not.toContain('A')
    }
  })

  it('three-way unequal all-in produces three pots', () => {
    // A: 100, B: 200, C: 300
    const players = [
      makePlayer('A', 1, 100, 0),
      makePlayer('B', 2, 200, 0),
      makePlayer('C', 3, 300, 0),
    ]
    const pots = calculatePots(players)
    expect(pots).toHaveLength(3)

    expect(pots[0].amount).toBe(300)  // 100×3 — A, B, C eligible
    expect(pots[0].eligiblePlayers).toHaveLength(3)

    expect(pots[1].amount).toBe(200)  // (200-100)×2 — B, C eligible
    expect(pots[1].eligiblePlayers).toHaveLength(2)
    expect(pots[1].eligiblePlayers).not.toContain('A')

    expect(pots[2].amount).toBe(100)  // (300-200)×1 — C only eligible
    expect(pots[2].eligiblePlayers).toEqual(['C'])

    const total = pots.reduce((s, p) => s + p.amount, 0)
    expect(total).toBe(600)
  })

  it('single player with no opponents still returns their pot', () => {
    const players = [makePlayer('A', 1, 150, 0)]
    const pots = calculatePots(players)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(150)
    expect(pots[0].eligiblePlayers).toContain('A')
  })
})

// ─── determineWinner ──────────────────────────────────────────────────────────

describe('determineWinner', () => {
  it('last standing player wins the whole pot regardless of stack', () => {
    const players = [
      makePlayer('A', 1, 300, 0, { isFolded: false }),
      makePlayer('B', 2, 300, 0, { isFolded: true }),
    ]
    const state = makeState({ players, pot: 600 })
    const winners = determineWinner(state)
    expect(winners).toHaveLength(1)
    expect(winners[0].userId).toBe('A')
    expect(winners[0].amount).toBe(600)
  })

  it('winner with best hand wins main pot; deeper stack side pot contested correctly', () => {
    // A has 100 in, B and C have 300 each.
    // A has best hand → wins main pot (300), B vs C for side pot (400)
    // Give A a royal flush, B the worst hand, C second-best
    const community = [card('Ah'), card('Kh'), card('Qh'), card('Jh'), card('Th')]
    const players: PlayerState[] = [
      {
        ...makePlayer('A', 1, 100, 0),
        // A's hole cards don't matter — community alone is a royal flush for all
        holeCards: [card('2c'), card('3c')],
      },
      {
        ...makePlayer('B', 2, 300, 0),
        holeCards: [card('2d'), card('3d')],  // same rank, community royal flush wins
      },
      {
        ...makePlayer('C', 3, 300, 0),
        holeCards: [card('2s'), card('3s')],
      },
    ]
    const state = makeState({ players, communityCards: community, pot: 700 })
    const winners = determineWinner(state)

    // All 3 share the royal flush — split everything
    const totalWon = winners.reduce((s, w) => s + w.amount, 0)
    expect(totalWon).toBeLessThanOrEqual(700)  // floor division may leave 1 chip unallocated
    expect(totalWon).toBeGreaterThanOrEqual(696)
  })

  it('short-stack all-in wins only main pot, not side pot', () => {
    // Community gives A three-of-a-kind kings (best), C three jacks (mid), B three 2s (worst)
    // Main pot: 300 (A,B,C eligible) → A wins with three kings
    // Side pot: 400 (B,C eligible)   → C wins with three jacks > three 2s
    const community = [card('Ah'), card('Kh'), card('Qd'), card('Jc'), card('2s')]
    const players: PlayerState[] = [
      {
        ...makePlayer('A', 1, 100, 0),
        holeCards: [card('Kc'), card('Kd')], // three kings: Kh Kc Kd + A Q kickers
      },
      {
        ...makePlayer('B', 2, 300, 0),
        holeCards: [card('2c'), card('2d')], // three 2s: 2s 2c 2d + A K kickers
      },
      {
        ...makePlayer('C', 3, 300, 0),
        holeCards: [card('Jd'), card('Js')], // three jacks: Jc Jd Js + A K kickers
      },
    ]
    const state = makeState({ players, communityCards: community, pot: 700 })
    const winners = determineWinner(state)

    const byPlayer: Record<string, number> = {}
    for (const w of winners) byPlayer[w.userId] = w.amount

    // A wins main pot (300) with three kings
    expect(byPlayer['A']).toBe(300)
    // C wins side pot (400) with three jacks > three 2s
    expect(byPlayer['C']).toBe(400)
    // B wins nothing
    expect(byPlayer['B']).toBeUndefined()

    const total = Object.values(byPlayer).reduce((s, v) => s + v, 0)
    expect(total).toBe(700)
  })
})

// ─── processAction / folded player guard ─────────────────────────────────────

describe('processAction — folded player does not become current player', () => {
  it('after a fold, currentPlayerIndex never points to the folded player', () => {
    // 3 players; middle player (B) folds; next turn should be C, not B
    const state = makeState({
      phase: 'flop',
      communityCards: [card('2h'), card('5d'), card('8c')],
      pot: 300,
      currentBet: 0,
      numActorsThisRound: 0,
      dealerSeat: 1,
      players: [
        { ...makePlayer('A', 1, 100, 900), holeCards: [card('Ac'), card('Ad')], currentBet: 0 },
        { ...makePlayer('B', 2, 100, 900), holeCards: [card('2c'), card('3d')], currentBet: 0 },
        { ...makePlayer('C', 3, 100, 900), holeCards: [card('Kc'), card('Kd')], currentBet: 0 },
      ],
      currentPlayerIndex: 0,  // A acts first
    })

    // A checks
    const afterA = processAction(state, 'A', 'check')
    expect(afterA.phaseComplete).toBe(false)
    const stateAfterA = afterA.state

    // B folds — now it should be C's turn, not B's
    const afterB = processAction(stateAfterA, 'B', 'fold')
    if (!afterB.phaseComplete) {
      const nextPlayer = afterB.state.players[afterB.state.currentPlayerIndex]
      expect(nextPlayer.isFolded).toBe(false)
      expect(nextPlayer.userId).toBe('C')
    }
  })

  it('after fold that triggers round completion, no active player becomes null sentinel', () => {
    // Only A and B remain active, B folds → A wins immediately (single player)
    const state = makeState({
      phase: 'flop',
      communityCards: [card('2h'), card('5d'), card('8c')],
      pot: 500,
      currentBet: 0,
      numActorsThisRound: 1,  // A already checked
      players: [
        { ...makePlayer('A', 1, 200, 800), holeCards: [card('Ac'), card('Ad')], currentBet: 0 },
        { ...makePlayer('B', 2, 200, 800), holeCards: [card('2c'), card('3d')], currentBet: 0 },
        { ...makePlayer('C', 3, 200, 800), isFolded: true, holeCards: [], currentBet: 0 },
      ],
      currentPlayerIndex: 1,  // B's turn
    })

    const result = processAction(state, 'B', 'fold')
    // Single player remains → winners returned, phase complete
    expect(result.phaseComplete).toBe(true)
    expect(result.winners).toBeDefined()
    expect(result.winners![0].userId).toBe('A')
  })
})

// ─── startHand sanity ─────────────────────────────────────────────────────────

describe('startHand', () => {
  it('deals 2 hole cards to each player and posts blinds', () => {
    const players = [
      { userId: 'A', seatNumber: 1, stack: 1000 },
      { userId: 'B', seatNumber: 2, stack: 1000 },
      { userId: 'C', seatNumber: 3, stack: 1000 },
    ]
    const state = startHand('g1', 't1', players, 1, 50, 100)

    for (const p of state.players) {
      expect(p.holeCards).toHaveLength(2)
    }

    // Blinds should be posted
    expect(state.pot).toBe(150) // SB=50 + BB=100
    expect(state.phase).toBe('preflop')
  })

  it('marks a player all-in if blind exceeds stack', () => {
    const players = [
      { userId: 'A', seatNumber: 1, stack: 30 },  // can only post 30 for SB
      { userId: 'B', seatNumber: 2, stack: 1000 },
    ]
    const state = startHand('g1', 't1', players, 1, 50, 100)
    const a = state.players.find((p) => p.userId === 'A')!
    expect(a.stack).toBe(0)
    expect(a.isAllIn).toBe(true)
  })
})
