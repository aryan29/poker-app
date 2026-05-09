/**
 * test-poker-sim.js
 * Self-contained Texas Hold'em poker simulation test.
 * Inlines all logic from game.ts / deck.ts / evaluator.ts (plain JS).
 */

'use strict';

// ─── deck.js (inlined) ───────────────────────────────────────────────────────

const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUIT_CODES = ['c','d','h','s'];
const RANK_VALUE = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,
  '9':9,'T':10,'J':11,'Q':12,'K':13,'A':14,
};

function createDeck() {
  const deck = [];
  for (const suit of SUIT_CODES) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

function shuffleDeck(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createShuffledDeck() {
  return shuffleDeck(createDeck());
}

function stringToCard(code) {
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  return { rank, suit, code };
}

// ─── evaluator.js (inlined) ──────────────────────────────────────────────────

const HAND_RANK_VALUE = {
  'high-card': 1, 'pair': 2, 'two-pair': 3, 'three-of-a-kind': 4,
  'straight': 5,  'flush': 6, 'full-house': 7, 'four-of-a-kind': 8,
  'straight-flush': 9, 'royal-flush': 10,
};

function cardValue(card) { return RANK_VALUE[card.rank]; }

function sortDesc(cards) {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a));
}

function groupByRank(cards) {
  const map = new Map();
  for (const card of cards) {
    const v = cardValue(card);
    const group = map.get(v) ?? [];
    group.push(card);
    map.set(v, group);
  }
  return map;
}

function isStraight(cards) {
  const sorted = sortDesc(cards);
  const values = sorted.map(cardValue);
  let normal = true;
  for (let i = 0; i < 4; i++) {
    if (values[i] - values[i + 1] !== 1) { normal = false; break; }
  }
  if (normal) return { is: true, high: values[0] };
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2)
    return { is: true, high: 5 };
  return { is: false };
}

function isFlush(cards) {
  return cards.every((c) => c.suit === cards[0].suit);
}

function rankLabel(value) {
  const map = { 14:'Ace',13:'King',12:'Queen',11:'Jack',10:'Ten',9:'Nine',
    8:'Eight',7:'Seven',6:'Six',5:'Five',4:'Four',3:'Three',2:'Two' };
  return map[value] ?? String(value);
}

function combinations(cards, k) {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluate5(cards) {
  const sorted = sortDesc(cards);
  const values = sorted.map(cardValue);
  const flush = isFlush(sorted);
  const straightResult = isStraight(sorted);
  const groups = groupByRank(sorted);
  const groupEntries = Array.from(groups.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return b[0] - a[0];
  });
  const counts = groupEntries.map(([, c]) => c.length);

  if (flush && straightResult.is && straightResult.high === 14)
    return { rank:'royal-flush', rankValue:10, tiebreakers:[14], cards:sorted, description:'Royal Flush' };
  if (flush && straightResult.is)
    return { rank:'straight-flush', rankValue:9, tiebreakers:[straightResult.high], cards:sorted,
      description:`Straight Flush, ${rankLabel(straightResult.high)} high` };
  if (counts[0] === 4) {
    const quad = groupEntries[0][0], kicker = groupEntries[1][0];
    return { rank:'four-of-a-kind', rankValue:8, tiebreakers:[quad,kicker], cards:sorted,
      description:`Four of a Kind, ${rankLabel(quad)}s` };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    const trips = groupEntries[0][0], pair = groupEntries[1][0];
    return { rank:'full-house', rankValue:7, tiebreakers:[trips,pair], cards:sorted,
      description:`Full House, ${rankLabel(trips)}s full of ${rankLabel(pair)}s` };
  }
  if (flush)
    return { rank:'flush', rankValue:6, tiebreakers:values, cards:sorted,
      description:`Flush, ${rankLabel(values[0])} high` };
  if (straightResult.is)
    return { rank:'straight', rankValue:5, tiebreakers:[straightResult.high], cards:sorted,
      description:`Straight, ${rankLabel(straightResult.high)} high` };
  if (counts[0] === 3) {
    const trips = groupEntries[0][0];
    const kickers = groupEntries.slice(1).map(([v]) => v);
    return { rank:'three-of-a-kind', rankValue:4, tiebreakers:[trips,...kickers], cards:sorted,
      description:`Three of a Kind, ${rankLabel(trips)}s` };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const high = groupEntries[0][0], low = groupEntries[1][0], kicker = groupEntries[2][0];
    return { rank:'two-pair', rankValue:3, tiebreakers:[high,low,kicker], cards:sorted,
      description:`Two Pair, ${rankLabel(high)}s and ${rankLabel(low)}s` };
  }
  if (counts[0] === 2) {
    const pair = groupEntries[0][0];
    const kickers = groupEntries.slice(1).map(([v]) => v);
    return { rank:'pair', rankValue:2, tiebreakers:[pair,...kickers], cards:sorted,
      description:`Pair of ${rankLabel(pair)}s` };
  }
  return { rank:'high-card', rankValue:1, tiebreakers:values, cards:sorted,
    description:`High Card, ${rankLabel(values[0])}` };
}

function compareHands(a, b) {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function evaluateHand(cards) {
  const parsed = cards.map((code) => {
    const rank = code.slice(0, -1);
    const suit = code.slice(-1);
    return { rank, suit, code };
  });
  if (parsed.length < 5) throw new Error(`Need at least 5 cards, got ${parsed.length}`);
  const combos = combinations(parsed, 5);
  let best = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) best = result;
  }
  return best;
}

function findWinners(hands) {
  const results = hands.map(({ userId, cards }) => ({ userId, handResult: evaluateHand(cards) }));
  results.sort((a, b) => compareHands(b.handResult, a.handResult));
  const best = results[0].handResult;
  return results.filter((r) => compareHands(r.handResult, best) === 0);
}

// ─── game.js (inlined) ───────────────────────────────────────────────────────

function getPlayersBySeatOrder(players, startAfterSeat) {
  const sorted = [...players].sort((a, b) => a.seatNumber - b.seatNumber);
  const pivot = sorted.findIndex((p) => p.seatNumber > startAfterSeat);
  if (pivot === -1) return sorted;
  return [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
}

function getNextActiveIndex(state, afterSeat) {
  const ordered = getPlayersBySeatOrder(state.players, afterSeat);
  const next = ordered.find((p) => !p.isFolded && !p.isAllIn);
  if (!next) return state.currentPlayerIndex;
  return state.players.findIndex((p) => p.userId === next.userId);
}

function postBlind(state, playerIndex, amount) {
  const player = state.players[playerIndex];
  const actual = Math.min(amount, player.stack);
  player.stack -= actual;
  player.currentBet = actual;
  player.totalBet += actual;
  state.pot += actual;
  if (player.stack === 0) player.isAllIn = true;
}

function resetBettingRound(state) {
  for (const p of state.players) p.currentBet = 0;
  state.currentBet = 0;
  state.lastRaiseAmount = state.bigBlind;
  state.lastRaiserIndex = -1;
  state.numActorsThisRound = 0;
  state.currentPlayerIndex = getNextActiveIndex(state, state.dealerSeat);
}

function isBettingRoundComplete(state) {
  const active = state.players.filter((p) => !p.isFolded && !p.isAllIn);
  if (active.length === 0) return true;
  const maxBet = Math.max(...state.players.map((p) => p.currentBet));
  const betsEqual = active.every((p) => p.currentBet === maxBet);
  return betsEqual && state.numActorsThisRound >= active.length;
}

function findNextPlayerIndex(state, currentIndex) {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n;
    const p = state.players[idx];
    if (!p.isFolded && !p.isAllIn) return idx;
  }
  return currentIndex;
}

function startHand(gameId, tableId, players, dealerSeat, smallBlind, bigBlind) {
  const deck = createShuffledDeck();
  const playerStates = players.map((p) => ({
    userId: p.userId,
    seatNumber: p.seatNumber,
    stack: p.stack,
    holeCards: [],
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBet: 0,
  }));

  const state = {
    gameId, tableId,
    phase: 'preflop',
    deck,
    communityCards: [],
    pot: 0,
    currentBet: bigBlind,
    players: playerStates,
    dealerSeat,
    currentPlayerIndex: 0,
    smallBlind, bigBlind,
    lastRaiseAmount: bigBlind,
    lastRaiserIndex: -1,
    sidePots: [],
    numActorsThisRound: 0,
  };

  const sbIndex = getNextActiveIndex(state, dealerSeat);
  const bbIndex = getNextActiveIndex(state, playerStates[sbIndex].seatNumber);
  postBlind(state, sbIndex, smallBlind);
  postBlind(state, bbIndex, bigBlind);
  state.lastRaiserIndex = bbIndex;

  for (let round = 0; round < 2; round++) {
    const ordered = getPlayersBySeatOrder(playerStates, dealerSeat);
    for (const player of ordered) {
      const card = deck.pop();
      player.holeCards.push(card);
    }
  }

  state.currentPlayerIndex = getNextActiveIndex(state, playerStates[bbIndex].seatNumber);
  return state;
}

function determineWinner(state) {
  const activePlayers = state.players.filter((p) => !p.isFolded);
  if (activePlayers.length === 1) {
    return [{
      userId: activePlayers[0].userId,
      handResult: { rank:'high-card', rankValue:1, tiebreakers:[], cards:[], description:'Last player standing' },
      amount: state.pot,
    }];
  }
  const hands = activePlayers.map((p) => ({
    userId: p.userId,
    cards: [...p.holeCards, ...state.communityCards].map((c) => c.code),
  }));
  const winners = findWinners(hands);
  const amountEach = Math.floor(state.pot / winners.length);
  return winners.map((w) => ({ userId: w.userId, handResult: w.handResult, amount: amountEach }));
}

function processAction(state, userId, action, amount = 0) {
  const playerIndex = state.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== state.currentPlayerIndex) throw new Error("Not this player's turn");

  const player = state.players[playerIndex];
  const maxBet = Math.max(...state.players.map((p) => p.currentBet));
  const callAmount = maxBet - player.currentBet;

  switch (action) {
    case 'fold':
      player.isFolded = true;
      break;
    case 'check':
      if (callAmount > 0) throw new Error('Cannot check — there is a bet to call');
      break;
    case 'call': {
      const actual = Math.min(callAmount, player.stack);
      player.stack -= actual;
      player.currentBet += actual;
      player.totalBet += actual;
      state.pot += actual;
      if (player.stack === 0) player.isAllIn = true;
      break;
    }
    case 'raise': {
      const minRaise = callAmount + state.lastRaiseAmount;
      if (amount < minRaise) throw new Error(`Minimum raise total is ${minRaise}`);
      const toAdd = Math.min(amount - player.currentBet, player.stack);
      player.stack -= toAdd;
      state.lastRaiseAmount = toAdd - callAmount;
      player.currentBet += toAdd;
      player.totalBet += toAdd;
      state.pot += toAdd;
      state.currentBet = player.currentBet;
      state.lastRaiserIndex = playerIndex;
      if (player.stack === 0) player.isAllIn = true;
      break;
    }
    case 'all-in':
    case 'all_in': {
      const allInAmount = player.stack;
      player.currentBet += allInAmount;
      player.totalBet += allInAmount;
      state.pot += allInAmount;
      player.stack = 0;
      player.isAllIn = true;
      if (player.currentBet > maxBet) {
        state.lastRaiseAmount = player.currentBet - maxBet;
        state.lastRaiserIndex = playerIndex;
        state.currentBet = player.currentBet;
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  const nonFolded = state.players.filter((p) => !p.isFolded);
  if (nonFolded.length === 1) {
    const winners = determineWinner(state);
    return { state, phaseComplete: true, winners };
  }

  const nextIndex = findNextPlayerIndex(state, playerIndex);
  state.currentPlayerIndex = nextIndex;
  state.numActorsThisRound += 1;

  if (isBettingRoundComplete(state)) {
    return { state, phaseComplete: true };
  }
  return { state, phaseComplete: false };
}

function advancePhase(state) {
  if (state.phase === 'preflop') {
    if (state.phase !== 'preflop') throw new Error('Not in preflop phase');
    state.deck.pop(); // burn
    state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.phase = 'flop';
  } else if (state.phase === 'flop') {
    state.deck.pop(); // burn
    state.communityCards.push(state.deck.pop());
    state.phase = 'turn';
  } else if (state.phase === 'turn') {
    state.deck.pop(); // burn
    state.communityCards.push(state.deck.pop());
    state.phase = 'river';
  } else {
    throw new Error(`Cannot advance from phase: ${state.phase}`);
  }
  resetBettingRound(state);
  return state;
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

let bugs = [];
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
    bugs.push(label);
  }
}

function currentPlayerName(state) {
  return state.players[state.currentPlayerIndex]?.userId ?? '(none)';
}

function describeState(state) {
  return `[${state.phase}] pot=${state.pot} currentBet=${state.currentBet} ` +
    `actors=${state.numActorsThisRound} currentPlayer=${currentPlayerName(state)}\n` +
    state.players.map(p =>
      `    ${p.userId}: stack=${p.stack} currentBet=${p.currentBet} ` +
      `folded=${p.isFolded} allIn=${p.isAllIn}`
    ).join('\n');
}

// ─── Simulate a complete hand step-by-step ───────────────────────────────────

function runFullHand(label, players, dealerSeat, smallBlind, bigBlind, script) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SCENARIO: ${label}`);
  console.log(`${'─'.repeat(60)}`);

  const state = startHand('game-1', 'table-1', players, dealerSeat, smallBlind, bigBlind);
  console.log('After startHand:\n' + describeState(state));

  const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  let stepCount = 0;
  const MAX_STEPS = 40; // safety limit to detect infinite loops

  for (const { userId, action, amount } of script) {
    if (state.phase === 'showdown') break;
    stepCount++;
    if (stepCount > MAX_STEPS) {
      console.log('  BUG: Exceeded MAX_STEPS — possible infinite loop!');
      bugs.push(`${label}: exceeded ${MAX_STEPS} steps — likely infinite loop`);
      failed++;
      return null;
    }

    const before = state.phase;
    const expected = userId;
    const actual = currentPlayerName(state);

    if (actual !== expected) {
      console.log(`  BUG: Expected ${expected} to act, but it is ${actual}'s turn`);
      bugs.push(`${label}: wrong player turn — expected ${expected}, got ${actual}`);
      failed++;
    }

    console.log(`\nStep ${stepCount}: ${actual}.${action}(${amount ?? ''})  [phase=${state.phase}]`);

    let result;
    try {
      result = processAction(state, actual, action, amount ?? 0);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      bugs.push(`${label}: processAction threw "${e.message}"`);
      failed++;
      return null;
    }

    if (result.winners) {
      console.log(`  Hand over (fold). Winners: ${result.winners.map(w => `${w.userId}+${w.amount}`).join(', ')}`);
      return { state: result.state, winners: result.winners };
    }

    if (result.phaseComplete) {
      console.log(`  Betting round complete. Advancing phase from ${state.phase}...`);
      if (state.phase !== 'river') {
        advancePhase(state);
        console.log(`  New phase: ${state.phase}\n` + describeState(state));
      } else {
        // River complete → showdown
        const winners = determineWinner(state);
        state.phase = 'showdown';
        console.log(`  SHOWDOWN! Winners: ${winners.map(w => `${w.userId}+${w.amount} (${w.handResult.description})`).join(', ')}`);
        return { state, winners };
      }
    } else {
      console.log('  ' + describeState(state));
    }
  }

  if (state.phase !== 'showdown') {
    console.log(`  NOTE: Script ended but game is still in phase=${state.phase}`);
  }

  return { state };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Basic 2-player hand — both check/call through all streets
// ─────────────────────────────────────────────────────────────────────────────

(function test_basic_2player_check_down() {
  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  // Dealer=seat1 (P1). In heads-up: dealer/SB=P1(seat1), BB=P2(seat2)
  // Preflop: P1 is UTG = first to act (also SB in HU), P2 is BB
  // P1 posted SB=10, P2 posted BB=20, currentBet=20
  // First to act preflop in HU: the dealer/SB (P1)
  const state = startHand('g1','t1', players, 1, 10, 20);

  console.log('\n' + '═'.repeat(60));
  console.log('TEST 1: 2-player check-down (preflop call then all checks)');
  console.log('─'.repeat(60));
  console.log('After startHand:\n' + describeState(state));

  // Verify initial state
  assert(state.phase === 'preflop', 'Phase is preflop');
  assert(state.pot === 30, `Pot is 30 (10 SB + 20 BB), got ${state.pot}`);
  assert(state.currentBet === 20, `currentBet is 20, got ${state.currentBet}`);

  // ENGINE BEHAVIOR NOTE (BUG #1 documented here):
  // With dealer=seat1(P1), the engine treats SB as the player LEFT of dealer.
  // So in 2-player: SB=P2(seat2), BB=P1(seat1).
  // Standard HU rules say dealer=SB, so this is inverted.
  // The engine applies 3+-player convention uniformly even for HU.
  // Result: P2(SB) acts first preflop (UTG in engine = left of BB=P1 = P2).
  const firstToAct = state.players[state.currentPlayerIndex].userId;
  console.log(`  First to act preflop: ${firstToAct}`);
  console.log('  NOTE: Engine assigns SB=P2, BB=P1 for 2-player with dealer=seat1');
  console.log('        Standard HU rules: dealer=SB, so SB should be P1 — this is BUG #1');
  assert(firstToAct === 'P2', `Engine: P2(SB) acts first preflop (engine uses 3p convention), got ${firstToAct}`);

  // P2 (SB) calls (puts in 10 more to match BB of 20)
  let r = processAction(state, 'P2', 'call');
  assert(!r.phaseComplete, 'After P2 call, round not complete yet (P1/BB must get option)');
  assert(state.pot === 40, `Pot is 40 after P2 call, got ${state.pot}`);
  console.log('After P2 call:\n' + describeState(state));

  // P1 (BB) checks (BB option)
  r = processAction(state, 'P1', 'check');
  assert(r.phaseComplete, 'After P1 check, preflop round complete');
  console.log('After P1 check (preflop complete):\n' + describeState(state));

  // Advance to flop
  advancePhase(state);
  assert(state.phase === 'flop', `Phase advanced to flop, got ${state.phase}`);
  assert(state.communityCards.length === 3, `3 community cards on flop, got ${state.communityCards.length}`);
  assert(state.currentBet === 0, `currentBet reset to 0 on flop, got ${state.currentBet}`);
  assert(state.numActorsThisRound === 0, `numActorsThisRound reset to 0, got ${state.numActorsThisRound}`);
  console.log('After dealFlop:\n' + describeState(state));

  // Flop: both check
  // Post-flop: resetBettingRound sets first to act = getNextActiveIndex(state, dealerSeat=1)
  // = first active player with seat > 1 = P2(seat2). So P2 acts first post-flop.
  const flopFirst = state.players[state.currentPlayerIndex].userId;
  console.log(`  First to act on flop: ${flopFirst}`);
  assert(flopFirst === 'P2', `P2 acts first on flop (first left of dealer seat), got ${flopFirst}`);

  r = processAction(state, 'P2', 'check');
  assert(!r.phaseComplete, 'After P2 check on flop, round not complete');
  r = processAction(state, 'P1', 'check');
  assert(r.phaseComplete, 'After P1 check on flop, flop round complete');

  // Advance to turn
  advancePhase(state);
  assert(state.phase === 'turn', `Phase is turn, got ${state.phase}`);
  assert(state.communityCards.length === 4, `4 community cards on turn, got ${state.communityCards.length}`);
  console.log('After dealTurn:\n' + describeState(state));

  // Turn: both check
  r = processAction(state, state.players[state.currentPlayerIndex].userId, 'check');
  assert(!r.phaseComplete, 'Turn: after 1st check, round not complete');
  r = processAction(state, state.players[state.currentPlayerIndex].userId, 'check');
  assert(r.phaseComplete, 'Turn: after 2nd check, round complete');

  // Advance to river
  advancePhase(state);
  assert(state.phase === 'river', `Phase is river, got ${state.phase}`);
  assert(state.communityCards.length === 5, `5 community cards on river, got ${state.communityCards.length}`);

  // River: both check
  r = processAction(state, state.players[state.currentPlayerIndex].userId, 'check');
  assert(!r.phaseComplete, 'River: after 1st check, round not complete');
  r = processAction(state, state.players[state.currentPlayerIndex].userId, 'check');
  assert(r.phaseComplete, 'River: after 2nd check, round complete → showdown');

  // Showdown
  const winners = determineWinner(state);
  assert(winners.length >= 1, 'There is at least one winner');
  assert(winners.reduce((sum, w) => sum + w.amount, 0) === 40, `Winners receive total pot of 40`);
  console.log(`  Showdown winner(s): ${winners.map(w => `${w.userId}+${w.amount} (${w.handResult.description})`).join(', ')}`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: 2-player fold (P1 folds preflop)
// ─────────────────────────────────────────────────────────────────────────────

(function test_fold_preflop() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 2: P1 folds preflop');
  console.log('─'.repeat(60));

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g2','t1', players, 1, 10, 20);
  console.log('After startHand:\n' + describeState(state));

  // Engine: SB=P2 acts first. P2 folds → P1(BB) wins.
  const r = processAction(state, 'P2', 'fold');
  assert(r.phaseComplete, 'Phase complete after fold');
  assert(!!r.winners, 'Winners returned after fold');
  assert(r.winners[0].userId === 'P1', `P1(BB) wins after P2(SB) folds, got ${r.winners?.[0]?.userId}`);
  assert(r.winners[0].amount === 30, `P1 wins pot of 30, got ${r.winners?.[0]?.amount}`);
  console.log(`  Winners: ${r.winners.map(w => `${w.userId}+${w.amount}`).join(', ')}`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: 3-player hand — test action order and actor counting
// ─────────────────────────────────────────────────────────────────────────────

(function test_3player_action_order() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 3: 3-player action order (preflop)');
  console.log('─'.repeat(60));

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
    { userId: 'P3', seatNumber: 3, stack: 1000 },
  ];
  // Dealer=1 (P1), SB=P2(seat2), BB=P3(seat3), UTG=P1(seat1)
  const state = startHand('g3','t1', players, 1, 10, 20);
  console.log('After startHand:\n' + describeState(state));

  assert(state.pot === 30, `Pot is 30 (SB+BB), got ${state.pot}`);
  const first = state.players[state.currentPlayerIndex].userId;
  assert(first === 'P1', `P1 (UTG, dealer in 3p) acts first preflop, got ${first}`);

  // P1 calls
  let r = processAction(state, 'P1', 'call');
  assert(!r.phaseComplete, 'Round not complete after P1 call');
  const second = state.players[state.currentPlayerIndex].userId;
  assert(second === 'P2', `P2 (SB) acts second, got ${second}`);

  // P2 calls
  r = processAction(state, 'P2', 'call');
  assert(!r.phaseComplete, 'Round not complete after P2 call');
  const third = state.players[state.currentPlayerIndex].userId;
  assert(third === 'P3', `P3 (BB) acts third, got ${third}`);

  // P3 checks (BB option)
  r = processAction(state, 'P3', 'check');
  assert(r.phaseComplete, 'Round complete after P3 check (BB option)');
  console.log('After P3 check:\n' + describeState(state));

  // Advance to flop
  advancePhase(state);
  console.log('After dealFlop:\n' + describeState(state));
  const flopFirst = state.players[state.currentPlayerIndex].userId;
  // Post-flop: first to act is first active player left of dealer (P2, seat 2)
  assert(flopFirst === 'P2', `P2 acts first on flop (left of dealer), got ${flopFirst}`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Raise and re-open action (the "round and round" bug candidate)
// ─────────────────────────────────────────────────────────────────────────────

(function test_raise_reopens_action() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 4: Raise re-opens action (numActorsThisRound logic)');
  console.log('─'.repeat(60));

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g4','t1', players, 1, 10, 20);
  console.log('After startHand:\n' + describeState(state));

  // Engine: SB=P2(acts first), BB=P1
  // P2 raises to 60
  let r = processAction(state, 'P2', 'raise', 60);
  assert(!r.phaseComplete, 'Round not complete after P2 raise');
  assert(state.currentBet === 60, `currentBet=60 after raise, got ${state.currentBet}`);
  console.log('After P2 raise to 60:\n' + describeState(state));

  // P1 (BB) calls 60
  r = processAction(state, 'P1', 'call');
  // After P1 calls, bets are equal and numActorsThisRound should be >= active players
  console.log('After P1 call:\n' + describeState(state));
  assert(r.phaseComplete, 'Round complete after P1 calls the raise');

  // Advance to flop
  advancePhase(state);
  console.log('After flop:\n' + describeState(state));

  // Flop: P2 checks, P1 raises, P2 calls → round should end (not loop)
  const fp1 = state.players[state.currentPlayerIndex].userId;
  r = processAction(state, fp1, 'check');
  assert(!r.phaseComplete, 'Not complete after 1st check on flop');
  const fp2 = state.players[state.currentPlayerIndex].userId;
  r = processAction(state, fp2, 'raise', 40);
  assert(!r.phaseComplete, 'Not complete after raise on flop (re-opens action)');
  console.log('After raise on flop:\n' + describeState(state));

  // Now the first player (who checked) must act again
  const fp3 = state.players[state.currentPlayerIndex].userId;
  assert(fp3 === fp1, `After raise, action returns to ${fp1}, got ${fp3}`);
  r = processAction(state, fp3, 'call');
  assert(r.phaseComplete, 'Round complete after caller responds to raise');
  console.log('After caller responds:\n' + describeState(state));
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: numActorsThisRound and isBettingRoundComplete — the core bug check
// ─────────────────────────────────────────────────────────────────────────────

(function test_bb_option_bug() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 5: BB option - does BB get to act when everyone just calls?');
  console.log('─'.repeat(60));

  // Bug scenario: in a 2-player game, P1 (SB) calls. numActorsThisRound=1.
  // isBettingRoundComplete checks: betsEqual=true (both at 20), numActors(1) >= active(2)? NO → not complete.
  // BB (P2) should get to act. This is correct behavior.
  // But what happens after BB checks?

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g5','t1', players, 1, 10, 20);

  // Engine assigns SB=P2, BB=P1 in 2-player with dealer=seat1.
  // P2 (SB) calls → pot=40, both at 20
  let r = processAction(state, 'P2', 'call');
  assert(!r.phaseComplete, 'Not complete after SB calls (BB must get option)');
  assert(state.numActorsThisRound === 1, `numActors=1 after SB call, got ${state.numActorsThisRound}`);

  // P1 (BB) checks
  r = processAction(state, 'P1', 'check');
  assert(r.phaseComplete, 'Complete after BB checks (both acted, bets equal)');

  // Key check: numActorsThisRound should be 2 just before phaseComplete
  // (processAction increments BEFORE calling isBettingRoundComplete)
  console.log(`  numActorsThisRound at completion: ${state.numActorsThisRound}`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: Simulate a full 2-player hand automatically (random cards)
// ─────────────────────────────────────────────────────────────────────────────

(function test_full_hand_automated() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 6: Full automated 2-player hand (check/call through all streets)');
  console.log('─'.repeat(60));

  const players = [
    { userId: 'Alice', seatNumber: 1, stack: 1000 },
    { userId: 'Bob',   seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g6','t1', players, 1, 10, 20);
  console.log('After startHand:\n' + describeState(state));

  const getActive = () => state.players.filter(p => !p.isFolded && !p.isAllIn);

  let stepCount = 0;
  const MAX_STEPS = 20;
  let finished = false;
  let winners = null;

  while (state.phase !== 'showdown' && !finished) {
    if (++stepCount > MAX_STEPS) {
      console.log('  BUG: Exceeded MAX_STEPS — infinite loop detected!');
      bugs.push('TEST 6: infinite loop in full automated hand');
      failed++;
      break;
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    const maxBet = Math.max(...state.players.map(p => p.currentBet));
    const callAmount = maxBet - currentPlayer.currentBet;
    const action = callAmount > 0 ? 'call' : 'check';

    console.log(`  [${state.phase}] ${currentPlayer.userId}.${action}()`);

    const r = processAction(state, currentPlayer.userId, action);

    if (r.winners) {
      winners = r.winners;
      state.phase = 'showdown';
      finished = true;
    } else if (r.phaseComplete) {
      if (state.phase === 'river') {
        winners = determineWinner(state);
        state.phase = 'showdown';
        finished = true;
      } else {
        advancePhase(state);
        console.log(`  => advanced to ${state.phase}`);
      }
    }
  }

  assert(state.phase === 'showdown', `Hand ended in showdown, got phase=${state.phase}`);
  assert(!!winners && winners.length >= 1, 'There are winners');
  if (winners) {
    const totalWon = winners.reduce((s, w) => s + w.amount, 0);
    assert(totalWon === 40, `Total won (${totalWon}) equals pot (40)`);
    console.log(`  Winner(s): ${winners.map(w => `${w.userId}+${w.amount} (${w.handResult.description})`).join(', ')}`);
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: Detect the "route.ts lastRaiserIndex not preserved" bug
// ─────────────────────────────────────────────────────────────────────────────

(function test_route_reconstruction_bug() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 7: route.ts state reconstruction — lastRaiserIndex always -1');
  console.log('─'.repeat(60));

  // In route.ts the reconstructed state always has lastRaiserIndex: -1.
  // This means after a raise, if the game state is saved and reloaded,
  // the raise "attribution" is lost, potentially allowing another raise
  // when it shouldn't be re-raised (min-raise calculation broken).
  // We simulate this by manually setting lastRaiserIndex = -1 mid-hand.

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g7','t1', players, 1, 10, 20);

  // Engine: SB=P2 acts first. P2 raises to 60.
  processAction(state, 'P2', 'raise', 60);
  assert(state.lastRaiserIndex !== -1, `lastRaiserIndex set after raise: ${state.lastRaiserIndex}`);

  // Simulate route.ts re-loading: lastRaiserIndex is always -1
  const routeReconstructed = { ...state, lastRaiserIndex: -1, lastRaiseAmount: 20 };
  // This is what route.ts does — it hardcodes lastRaiserIndex: -1 always

  console.log('  NOTE: route.ts always reconstructs with lastRaiserIndex: -1');
  console.log('  This means re-raise protection is broken across API calls.');
  console.log(`  Original lastRaiserIndex: ${state.lastRaiserIndex}`);
  console.log(`  Reconstructed lastRaiserIndex: ${routeReconstructed.lastRaiserIndex}`);

  // The practical bug: min raise calculation uses lastRaiseAmount
  // route.ts hardcodes lastRaiseAmount: tableConfig?.big_blind ?? 20
  // even when last raise was larger. This can allow under-raises.
  const tableConfig_bigBlind = 20;
  console.log(`  route.ts always sets lastRaiseAmount = ${tableConfig_bigBlind} (big blind)`);
  console.log('  BUG: Should preserve actual last raise amount from game state!');
  bugs.push('route.ts: lastRaiserIndex always -1 — raise tracking lost on every request');
  bugs.push('route.ts: lastRaiseAmount always reset to bigBlind — min-raise enforcement broken');
  failed += 2;
  console.log('  (These are code inspection bugs, not runtime assertions)');
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: Detect the numActorsThisRound increment-before-check ordering issue
// ─────────────────────────────────────────────────────────────────────────────

(function test_actor_count_ordering() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 8: numActorsThisRound increment ordering (before vs after isBettingRoundComplete)');
  console.log('─'.repeat(60));

  // In processAction, the order is:
  //   1. Apply action
  //   2. findNextPlayerIndex → state.currentPlayerIndex = nextIndex
  //   3. state.numActorsThisRound += 1   ← incremented AFTER setting next player
  //   4. isBettingRoundComplete(state)   ← checks numActorsThisRound
  //
  // isBettingRoundComplete uses active.length = players not folded/allIn
  // numActorsThisRound must be >= active.length
  //
  // For 2 active players: after actor 1 acts → numActors becomes 1, need >= 2 → not complete ✓
  // After actor 2 acts → numActors becomes 2, need >= 2 → complete ✓
  // This seems correct. But let's verify preflop special case:
  // Preflop BB has already "acted" by posting, but numActorsThisRound starts at 0.
  // P1 calls: numActors → 1, active=2, 1 >= 2? No → not complete ✓ (BB gets option)
  // P2 checks: numActors → 2, active=2, 2 >= 2? Yes → complete ✓
  // So far so good.
  //
  // But what about AFTER a raise re-opens action?
  // State: numActors=2, P2 raised → numActors=3
  // P1 must call. numActors=4 >= 2 → complete ✓
  // BUT: betsEqual check — after raise, P1.currentBet != P2.currentBet → not all equal → not complete ✓
  // After P1 calls → betsEqual=true, numActors=4 >= 2 → complete ✓
  // This looks correct.

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g8','t1', players, 1, 10, 20);

  // Engine: SB=P2 acts first preflop
  assert(state.numActorsThisRound === 0, `numActors starts at 0, got ${state.numActorsThisRound}`);

  let r = processAction(state, 'P2', 'call');
  assert(state.numActorsThisRound === 1, `numActors=1 after P2 call, got ${state.numActorsThisRound}`);
  assert(!r.phaseComplete, 'Not complete after P2 call (P1/BB must act)');

  r = processAction(state, 'P1', 'check');
  assert(state.numActorsThisRound === 2, `numActors=2 after P1 check, got ${state.numActorsThisRound}`);
  assert(r.phaseComplete, 'Complete after P1 checks');

  // Flop — numActors resets to 0
  advancePhase(state);
  assert(state.numActorsThisRound === 0, `numActors reset to 0 on new street, got ${state.numActorsThisRound}`);

  // P2 checks, P1 raises, P2 must re-act
  const flopP1 = state.players[state.currentPlayerIndex].userId;
  r = processAction(state, flopP1, 'check');
  assert(state.numActorsThisRound === 1, `numActors=1 after 1st check, got ${state.numActorsThisRound}`);
  assert(!r.phaseComplete, 'Not complete after 1st check');

  const flopP2 = state.players[state.currentPlayerIndex].userId;
  r = processAction(state, flopP2, 'raise', 50);
  assert(state.numActorsThisRound === 2, `numActors=2 after raise, got ${state.numActorsThisRound}`);
  assert(!r.phaseComplete, 'Not complete after raise (re-opens action to P1)');

  // P1 must call the raise
  const afterRaise = state.players[state.currentPlayerIndex].userId;
  assert(afterRaise === flopP1, `After raise, ${flopP1} must act again, got ${afterRaise}`);

  r = processAction(state, flopP1, 'call');
  assert(r.phaseComplete, 'Complete after P1 calls the raise');
  console.log('  numActorsThisRound ordering: CORRECT');
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: "Round and round" — preflop where BB never gets to act if SB folds
// ─────────────────────────────────────────────────────────────────────────────

(function test_sb_fold_preflop() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 9: SB folds preflop — hand ends immediately');
  console.log('─'.repeat(60));

  const players = [
    { userId: 'P1', seatNumber: 1, stack: 1000 },
    { userId: 'P2', seatNumber: 2, stack: 1000 },
  ];
  const state = startHand('g9','t1', players, 1, 10, 20);
  console.log('After startHand:\n' + describeState(state));

  // Engine: SB=P2 acts first, BB=P1. P2 folds → P1 wins.
  const r = processAction(state, 'P2', 'fold');
  assert(r.phaseComplete, 'Phase complete when P2 folds');
  assert(!!r.winners, 'Winners returned immediately');
  assert(r.winners[0].userId === 'P1', `P1(BB) wins after P2(SB) folds, got ${r.winners?.[0]?.userId}`);
  console.log(`  Winner: P1 wins ${r.winners[0].amount} chips`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: Run 10 random full hands — check none get stuck
// ─────────────────────────────────────────────────────────────────────────────

(function test_random_hands() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 10: 10 random full hands (auto check/call) — detect loops');
  console.log('─'.repeat(60));

  let handsCompleted = 0;
  const MAX_STEPS_PER_HAND = 30;

  for (let h = 0; h < 10; h++) {
    const players = [
      { userId: 'Alice', seatNumber: 1, stack: 500 },
      { userId: 'Bob',   seatNumber: 2, stack: 500 },
    ];
    const state = startHand(`g10-${h}`, 't1', players, 1, 5, 10);
    let steps = 0;
    let stuck = false;
    let handWinners = null;

    while (state.phase !== 'showdown') {
      if (++steps > MAX_STEPS_PER_HAND) {
        stuck = true;
        break;
      }
      const currentPlayer = state.players[state.currentPlayerIndex];
      const maxBet = Math.max(...state.players.map(p => p.currentBet));
      const callAmount = maxBet - currentPlayer.currentBet;
      const action = callAmount > 0 ? 'call' : 'check';

      const r = processAction(state, currentPlayer.userId, action);

      if (r.winners) {
        handWinners = r.winners;
        state.phase = 'showdown';
      } else if (r.phaseComplete) {
        if (state.phase === 'river') {
          handWinners = determineWinner(state);
          state.phase = 'showdown';
        } else {
          advancePhase(state);
        }
      }
    }

    if (stuck) {
      console.log(`  Hand ${h+1}: STUCK after ${MAX_STEPS_PER_HAND} steps!`);
      bugs.push(`Random hand ${h+1}: stuck in infinite loop`);
      failed++;
    } else {
      handsCompleted++;
      const winner = handWinners?.[0]?.userId ?? '?';
    }
  }

  assert(handsCompleted === 10, `All 10 random hands completed (no infinite loops), got ${handsCompleted}`);
  console.log(`  ${handsCompleted}/10 hands completed successfully`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log('SUMMARY');
console.log('═'.repeat(60));
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);

if (bugs.length > 0) {
  console.log('\nBUGS / ISSUES FOUND:');
  bugs.forEach((b, i) => console.log(`  ${i+1}. ${b}`));
} else {
  console.log('\nNo bugs found!');
}
console.log('');
