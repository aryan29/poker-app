#!/usr/bin/env node
'use strict';

// ─── Inlined deck logic ───────────────────────────────────────────────────────

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

// ─── Inlined evaluator logic ──────────────────────────────────────────────────

const HAND_RANK_VALUE = {
  'high-card': 1, 'pair': 2, 'two-pair': 3, 'three-of-a-kind': 4,
  'straight': 5, 'flush': 6, 'full-house': 7, 'four-of-a-kind': 8,
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
  if (values[0]===14 && values[1]===5 && values[2]===4 && values[3]===3 && values[4]===2) {
    return { is: true, high: 5 };
  }
  return { is: false };
}

function isFlush(cards) {
  return cards.every(c => c.suit === cards[0].suit);
}

function rankLabel(value) {
  const map = {14:'Ace',13:'King',12:'Queen',11:'Jack',10:'Ten',9:'Nine',8:'Eight',7:'Seven',6:'Six',5:'Five',4:'Four',3:'Three',2:'Two'};
  return map[value] ?? String(value);
}

function combinations(cards, k) {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
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
  if (flush && straightResult.is && straightResult.high === 14) return { rank:'royal-flush', rankValue:10, tiebreakers:[14], cards:sorted, description:'Royal Flush' };
  if (flush && straightResult.is) return { rank:'straight-flush', rankValue:9, tiebreakers:[straightResult.high], cards:sorted, description:`Straight Flush, ${rankLabel(straightResult.high)} high` };
  if (counts[0] === 4) { const quad=groupEntries[0][0]; const kicker=groupEntries[1][0]; return { rank:'four-of-a-kind', rankValue:8, tiebreakers:[quad,kicker], cards:sorted, description:`Four of a Kind, ${rankLabel(quad)}s` }; }
  if (counts[0] === 3 && counts[1] === 2) { const trips=groupEntries[0][0]; const pair=groupEntries[1][0]; return { rank:'full-house', rankValue:7, tiebreakers:[trips,pair], cards:sorted, description:`Full House, ${rankLabel(trips)}s full of ${rankLabel(pair)}s` }; }
  if (flush) return { rank:'flush', rankValue:6, tiebreakers:values, cards:sorted, description:`Flush, ${rankLabel(values[0])} high` };
  if (straightResult.is) return { rank:'straight', rankValue:5, tiebreakers:[straightResult.high], cards:sorted, description:`Straight, ${rankLabel(straightResult.high)} high` };
  if (counts[0] === 3) { const trips=groupEntries[0][0]; const kickers=groupEntries.slice(1).map(([v])=>v); return { rank:'three-of-a-kind', rankValue:4, tiebreakers:[trips,...kickers], cards:sorted, description:`Three of a Kind, ${rankLabel(trips)}s` }; }
  if (counts[0] === 2 && counts[1] === 2) { const high=groupEntries[0][0]; const low=groupEntries[1][0]; const kicker=groupEntries[2][0]; return { rank:'two-pair', rankValue:3, tiebreakers:[high,low,kicker], cards:sorted, description:`Two Pair, ${rankLabel(high)}s and ${rankLabel(low)}s` }; }
  if (counts[0] === 2) { const pair=groupEntries[0][0]; const kickers=groupEntries.slice(1).map(([v])=>v); return { rank:'pair', rankValue:2, tiebreakers:[pair,...kickers], cards:sorted, description:`Pair of ${rankLabel(pair)}s` }; }
  return { rank:'high-card', rankValue:1, tiebreakers:values, cards:sorted, description:`High Card, ${rankLabel(values[0])}` };
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
  const parsed = cards.map(code => {
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
  return results.filter(r => compareHands(r.handResult, best) === 0);
}

// ─── Inlined game logic ───────────────────────────────────────────────────────

function getPlayersBySeatOrder(players, startAfterSeat) {
  const sorted = [...players].sort((a, b) => a.seatNumber - b.seatNumber);
  const pivot = sorted.findIndex(p => p.seatNumber > startAfterSeat);
  if (pivot === -1) return sorted;
  return [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
}

function getNextActiveIndex(state, afterSeat) {
  const ordered = getPlayersBySeatOrder(state.players, afterSeat);
  const next = ordered.find(p => !p.isFolded && !p.isAllIn);
  if (!next) return state.currentPlayerIndex;
  return state.players.findIndex(p => p.userId === next.userId);
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
  const active = state.players.filter(p => !p.isFolded && !p.isAllIn);
  if (active.length === 0) return true;
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
  const betsEqual = active.every(p => p.currentBet === maxBet);
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
  const playerStates = players.map(p => ({
    userId: p.userId, seatNumber: p.seatNumber, stack: p.stack,
    holeCards: [], isFolded: false, isAllIn: false, currentBet: 0, totalBet: 0,
  }));

  const state = {
    gameId, tableId, phase: 'preflop', deck, communityCards: [], pot: 0,
    currentBet: bigBlind, players: playerStates, dealerSeat,
    currentPlayerIndex: 0, smallBlind, bigBlind,
    lastRaiseAmount: bigBlind, lastRaiserIndex: -1, sidePots: [], numActorsThisRound: 0,
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
  const activePlayers = state.players.filter(p => !p.isFolded);
  if (activePlayers.length === 1) {
    return [{ userId: activePlayers[0].userId, handResult: { rank:'high-card', rankValue:1, tiebreakers:[], cards:[], description:'Last player standing' }, amount: state.pot }];
  }
  const hands = activePlayers.map(p => ({ userId: p.userId, cards: [...p.holeCards, ...state.communityCards].map(c => c.code) }));
  const winners = findWinners(hands);
  const amountEach = Math.floor(state.pot / winners.length);
  return winners.map(w => ({ userId: w.userId, handResult: w.handResult, amount: amountEach }));
}

function processAction(state, userId, action, amount = 0) {
  const playerIndex = state.players.findIndex(p => p.userId === userId);
  if (playerIndex !== state.currentPlayerIndex) throw new Error("Not this player's turn");

  const player = state.players[playerIndex];
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
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

  const nonFolded = state.players.filter(p => !p.isFolded);
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
    state.deck.pop();
    state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.phase = 'flop';
    resetBettingRound(state);
    return state;
  }
  if (state.phase === 'flop') {
    state.deck.pop();
    state.communityCards.push(state.deck.pop());
    state.phase = 'turn';
    resetBettingRound(state);
    return state;
  }
  if (state.phase === 'turn') {
    state.deck.pop();
    state.communityCards.push(state.deck.pop());
    state.phase = 'river';
    resetBettingRound(state);
    return state;
  }
  throw new Error(`Cannot advance from phase: ${state.phase}`);
}

// ─── Test Utilities ───────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
const bugs = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.log(`  ✗ FAIL: ${testName}${details ? ' — ' + details : ''}`);
    failCount++;
    bugs.push({ test: testName, details });
  }
}

function stateSnapshot(state) {
  return `phase=${state.phase} pot=${state.pot} numActors=${state.numActorsThisRound} currentPlayerIndex=${state.currentPlayerIndex} players=[${state.players.map(p=>`${p.userId}:bet=${p.currentBet},stack=${p.stack},folded=${p.isFolded},allIn=${p.isAllIn}`).join(' | ')}]`;
}

// ─── TEST 1: Full 2-player game, both check every street ─────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 1: Full 2-player game — both players check every street');
console.log('══════════════════════════════════════════════════════════════');

try {
  // seats: dealer=1, SB=2(seat1 wraps), BB=2
  // With 2 players: dealer=seat 1, SB=seat 1 (dealer is SB in heads-up), BB=seat 2
  const state = startHand('g1', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, // dealerSeat
    5,  // SB
    10  // BB
  );

  console.log('\n  After startHand:');
  console.log(' ', stateSnapshot(state));

  const sbPlayer = state.players.find(p => p.currentBet === 5);
  const bbPlayer = state.players.find(p => p.currentBet === 10);
  assert(sbPlayer !== undefined, 'SB posted 5', `currentBets: ${state.players.map(p=>p.currentBet)}`);
  assert(bbPlayer !== undefined, 'BB posted 10', `currentBets: ${state.players.map(p=>p.currentBet)}`);
  assert(state.pot === 15, `Pot is 15 after blinds`, `pot=${state.pot}`);
  assert(state.phase === 'preflop', 'Phase starts as preflop');

  // In a 2-player game, SB is UTG and acts first preflop
  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`\n  Preflop: first actor is ${firstActor.userId} (index=${state.currentPlayerIndex})`);
  assert(firstActor !== undefined, 'There is a current player');

  // === PREFLOP ===
  // SB/UTG (Alice, seat 1) must call (she posted SB=5, BB=10, owes 5 more)
  // In heads-up, dealer/SB acts first preflop
  // Preflop: UTG=SB=Alice. BB=Bob has option after.
  // Alice calls (call to match BB of 10, she posted 5, so calls 5 more)
  console.log(`\n  Preflop: ${firstActor.userId} calls`);
  let result = processAction(state, firstActor.userId, 'call');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));

  // Now Bob (BB) should get to act (BB option)
  const secondActor = state.players[state.currentPlayerIndex];
  console.log(`\n  Preflop: second actor is ${secondActor.userId} (index=${state.currentPlayerIndex})`);
  assert(!result.phaseComplete, 'Preflop not complete after SB calls — BB gets option');
  assert(secondActor.userId !== firstActor.userId, 'BB (different player) gets to act after SB calls');

  // BB checks (option)
  console.log(`  Preflop: ${secondActor.userId} checks (BB option)`);
  result = processAction(state, secondActor.userId, 'check');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(result.phaseComplete, 'Preflop complete after BB checks');

  // === FLOP ===
  assert(state.phase === 'preflop', 'Still in preflop until advancePhase called');
  advancePhase(state);
  console.log(`\n  After dealFlop: phase=${state.phase}, community=${state.communityCards.map(c=>c.code)}`);
  assert(state.phase === 'flop', 'Phase advanced to flop');
  assert(state.communityCards.length === 3, 'Flop has 3 community cards', `got ${state.communityCards.length}`);
  assert(state.numActorsThisRound === 0, 'numActorsThisRound reset to 0 after flop');

  // Post-flop: BB acts first (left of dealer)
  const flopFirstActor = state.players[state.currentPlayerIndex];
  console.log(`  Flop: first actor is ${flopFirstActor.userId}`);

  // Both players check
  console.log(`  Flop: ${flopFirstActor.userId} checks`);
  result = processAction(state, flopFirstActor.userId, 'check');
  console.log(`  phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
  assert(!result.phaseComplete, 'Flop not complete after 1st player checks');

  const flopSecondActor = state.players[state.currentPlayerIndex];
  console.log(`  Flop: ${flopSecondActor.userId} checks`);
  result = processAction(state, flopSecondActor.userId, 'check');
  console.log(`  phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
  assert(result.phaseComplete, 'Flop complete after both players check');

  // === TURN ===
  advancePhase(state);
  console.log(`\n  After dealTurn: phase=${state.phase}, community=${state.communityCards.map(c=>c.code)}`);
  assert(state.phase === 'turn', 'Phase advanced to turn');
  assert(state.communityCards.length === 4, 'Turn has 4 community cards', `got ${state.communityCards.length}`);

  const turnFirstActor = state.players[state.currentPlayerIndex];
  console.log(`  Turn: first actor is ${turnFirstActor.userId}`);

  result = processAction(state, turnFirstActor.userId, 'check');
  console.log(`  phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
  assert(!result.phaseComplete, 'Turn not complete after 1st player checks');

  const turnSecondActor = state.players[state.currentPlayerIndex];
  result = processAction(state, turnSecondActor.userId, 'check');
  console.log(`  phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
  assert(result.phaseComplete, 'Turn complete after both players check');

  // === RIVER ===
  advancePhase(state);
  console.log(`\n  After dealRiver: phase=${state.phase}, community=${state.communityCards.map(c=>c.code)}`);
  assert(state.phase === 'river', 'Phase advanced to river');
  assert(state.communityCards.length === 5, 'River has 5 community cards', `got ${state.communityCards.length}`);

  const riverFirstActor = state.players[state.currentPlayerIndex];
  result = processAction(state, riverFirstActor.userId, 'check');
  assert(!result.phaseComplete, 'River not complete after 1st player checks');

  const riverSecondActor = state.players[state.currentPlayerIndex];
  result = processAction(state, riverSecondActor.userId, 'check');
  assert(result.phaseComplete, 'River complete after both players check — should reach showdown');

  // === SHOWDOWN ===
  const winners = determineWinner(state);
  console.log(`\n  Showdown winners: ${JSON.stringify(winners.map(w=>({ userId: w.userId, hand: w.handResult.description, amount: w.amount })))}`);
  assert(winners.length >= 1, 'Showdown produces at least one winner');
  assert(winners[0].amount > 0, 'Winner gets a non-zero pot amount', `amount=${winners[0].amount}`);

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 1: ${e.message}`);
  bugs.push({ test: 'Test 1 (full game, check-down)', details: `Exception: ${e.message}` });
}

// ─── TEST 2: Immediate fold ───────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 2: 2-player game — SB folds immediately preflop');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g2', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`  Preflop first actor: ${firstActor.userId}`);
  console.log(`  Folding ${firstActor.userId}...`);
  const result = processAction(state, firstActor.userId, 'fold');
  console.log(`  phaseComplete=${result.phaseComplete}, winners=${JSON.stringify(result.winners?.map(w=>w.userId))}`);
  console.log(' ', stateSnapshot(state));

  assert(result.phaseComplete, 'Game ends immediately after fold');
  assert(result.winners !== undefined, 'Winners are determined after fold');
  assert(result.winners && result.winners.length === 1, 'Exactly 1 winner after fold');
  const nonFolder = state.players.find(p => !p.isFolded);
  assert(result.winners && result.winners[0].userId === nonFolder?.userId, 'The non-folded player wins');
  assert(result.winners && result.winners[0].amount === state.pot, 'Winner gets entire pot');

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 2: ${e.message}`);
  bugs.push({ test: 'Test 2 (immediate fold)', details: `Exception: ${e.message}` });
}

// ─── TEST 3: All-in and call ──────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 3: 2-player game — one player goes all-in, other calls');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g3', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`\n  Preflop: first actor is ${firstActor.userId}`);

  // First actor goes all-in
  console.log(`  ${firstActor.userId} goes all-in (stack=${firstActor.stack})`);
  let result = processAction(state, firstActor.userId, 'all-in');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));

  assert(!result.phaseComplete, 'Phase NOT complete after all-in — opponent must still respond');

  // Verify the all-in player is flagged
  const allInPlayer = state.players.find(p => p.userId === firstActor.userId);
  assert(allInPlayer?.isAllIn === true, 'All-in player is flagged isAllIn=true');
  assert(allInPlayer?.stack === 0, 'All-in player has stack=0');

  // Second actor should still be able to call
  const secondActor = state.players[state.currentPlayerIndex];
  console.log(`\n  Second actor after all-in: ${secondActor.userId} (index=${state.currentPlayerIndex})`);
  assert(secondActor.userId !== firstActor.userId, 'The other player gets to respond to all-in');
  assert(!secondActor.isAllIn, 'The responding player is not yet all-in');

  console.log(`  ${secondActor.userId} calls the all-in`);
  result = processAction(state, secondActor.userId, 'call');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));

  assert(result.phaseComplete, 'Phase complete after call of all-in');

  const bothAllIn = state.players.every(p => p.isAllIn);
  console.log(`  Both players all-in: ${bothAllIn}`);
  assert(bothAllIn, 'Both players are all-in after the call');

  // Should be able to run out all streets automatically
  console.log('\n  Running out board (all players all-in)...');
  let phase = state.phase;
  let safetyCount = 0;
  while (phase !== 'river' && safetyCount++ < 10) {
    advancePhase(state);
    phase = state.phase;
    console.log(`  Advanced to: ${phase}, community=${state.communityCards.map(c=>c.code)}`);
  }

  assert(state.phase === 'river', 'Reached river after running out board');
  assert(state.communityCards.length === 5, 'All 5 community cards dealt');

  const winners = determineWinner(state);
  console.log(`  Showdown: ${JSON.stringify(winners.map(w=>({ userId:w.userId, hand:w.handResult.description, amount:w.amount })))}`);
  assert(winners.length >= 1, 'Showdown produces winner(s)');

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 3: ${e.message}`);
  bugs.push({ test: 'Test 3 (all-in and call)', details: `Exception: ${e.message}` });
}

// ─── TEST 4: Preflop raise-call cycle ────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 4: Preflop raise-call cycle — both players should act');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g4', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`  Preflop first actor: ${firstActor.userId}`);

  // First actor raises to 30
  console.log(`  ${firstActor.userId} raises to 30`);
  let result = processAction(state, firstActor.userId, 'raise', 30);
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(!result.phaseComplete, 'Phase not complete after raise');

  // Second actor calls
  const secondActor = state.players[state.currentPlayerIndex];
  console.log(`  ${secondActor.userId} calls the raise`);
  assert(secondActor.userId !== firstActor.userId, 'Different player gets to respond to raise');
  result = processAction(state, secondActor.userId, 'call');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(result.phaseComplete, 'Phase complete after call of raise');

  const totalPot = state.pot;
  assert(totalPot === 60, `Pot is 60 after both put in 30 (5+5 blinds = extra 15+15... wait: SB posted 5, BB posted 10, raiser put in 30 total, caller puts in 30 total = 60)`, `pot=${totalPot}`);

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 4: ${e.message}`);
  bugs.push({ test: 'Test 4 (preflop raise-call)', details: `Exception: ${e.message}` });
}

// ─── TEST 5: BB option — SB calls, BB should be able to raise ────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 5: BB option — SB calls, BB should get to raise (not just check)');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g5', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  const sbPlayer = state.players.find(p => p.currentBet === 5);
  const bbPlayer = state.players.find(p => p.currentBet === 10);
  console.log(`  SB: ${sbPlayer?.userId}, BB: ${bbPlayer?.userId}`);

  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`  Preflop first actor (should be SB/UTG): ${firstActor.userId}`);
  assert(firstActor.userId === sbPlayer?.userId, 'SB acts first preflop (UTG in heads-up)');

  // SB calls
  console.log(`  SB (${firstActor.userId}) calls`);
  let result = processAction(state, firstActor.userId, 'call');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(!result.phaseComplete, 'Preflop NOT complete after SB calls — BB gets option');

  // BB should now get to act
  const bbActorNow = state.players[state.currentPlayerIndex];
  console.log(`  Current actor after SB calls: ${bbActorNow.userId}`);
  assert(bbActorNow.userId === bbPlayer?.userId, 'BB gets to act (BB option)');

  // BB raises instead of checking
  console.log(`  BB (${bbActorNow.userId}) raises to 30`);
  result = processAction(state, bbActorNow.userId, 'raise', 30);
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(!result.phaseComplete, 'Preflop not complete after BB raises');

  // SB must now respond to BB's raise
  const sbResponseActor = state.players[state.currentPlayerIndex];
  console.log(`  Actor after BB raises: ${sbResponseActor.userId}`);
  assert(sbResponseActor.userId === sbPlayer?.userId, 'SB must respond to BB raise');

  // SB calls
  result = processAction(state, sbResponseActor.userId, 'call');
  console.log(`  phaseComplete=${result.phaseComplete}`);
  console.log(' ', stateSnapshot(state));
  assert(result.phaseComplete, 'Preflop complete after SB calls BB raise');

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 5: ${e.message}`);
  bugs.push({ test: 'Test 5 (BB option)', details: `Exception: ${e.message}` });
}

// ─── TEST 6: isBettingRoundComplete edge cases ────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 6: isBettingRoundComplete edge cases');
console.log('══════════════════════════════════════════════════════════════');

try {
  // Case A: Nobody has acted → should NOT be complete
  const state = startHand('g6', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  const completeBeforeAnyone = isBettingRoundComplete(state);
  console.log(`\n  isBettingRoundComplete before any action: ${completeBeforeAnyone}`);
  assert(!completeBeforeAnyone, 'Betting round not complete before any preflop action');

  // Case B: After SB calls (bets equal, but only 1 actor — BB hasn't acted)
  const actor1 = state.players[state.currentPlayerIndex];
  processAction(state, actor1.userId, 'call');
  const completeAfterSBCall = isBettingRoundComplete(state);
  console.log(`  isBettingRoundComplete after SB calls: ${completeAfterSBCall}`);
  assert(!completeAfterSBCall, 'Betting round not complete after SB calls (BB needs to act)');

  // Case C: After BB checks
  const actor2 = state.players[state.currentPlayerIndex];
  processAction(state, actor2.userId, 'check');
  const completeAfterBBCheck = isBettingRoundComplete(state);
  // Note: at this point processAction already advances state, but let's check
  console.log(`  After BB checks, state numActors=${state.numActorsThisRound}`);
  // processAction already incremented numActorsThisRound and moved to next player
  // but returned phaseComplete=true from its own check

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 6: ${e.message}`);
  bugs.push({ test: 'Test 6 (isBettingRoundComplete)', details: `Exception: ${e.message}` });
}

// ─── TEST 7: 3-player game, full check-down ───────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 7: 3-player game — all check every street');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g7', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 },
     { userId: 'Carol', seatNumber: 3, stack: 1000 }],
    1, // dealer = seat 1
    5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  // Preflop: UTG (seat 3 = Carol), then SB (seat 2 = Bob ... wait let me trace)
  // dealer=seat1=Alice; SB=next after dealer=seat2=Bob; BB=seat3=Carol; UTG=seat1=Alice
  // Actually: SB=next after seat1=seat2=Bob, BB=next after seat2=seat3=Carol, UTG=next after seat3 wraps to seat1=Alice

  const sbPlayer = state.players.find(p => p.currentBet === 5);
  const bbPlayer = state.players.find(p => p.currentBet === 10);
  console.log(`  SB: ${sbPlayer?.userId} (bet=${sbPlayer?.currentBet}), BB: ${bbPlayer?.userId} (bet=${bbPlayer?.currentBet})`);

  // Preflop: 3 players need to act
  let actors = [];
  for (let i = 0; i < 3; i++) {
    const actor = state.players[state.currentPlayerIndex];
    actors.push(actor.userId);
    console.log(`  Preflop action ${i+1}: ${actor.userId} calls`);
    const result = processAction(state, actor.userId, 'call');
    console.log(`    phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
    if (result.phaseComplete && i < 2) {
      console.log(`    *** Early completion at action ${i+1}! Expected 3 actions. BUG?`);
      bugs.push({ test: 'Test 7 (3-player preflop)', details: `Round ended after only ${i+1} actions, expected 3` });
      break;
    }
  }

  // After flop
  if (state.phase === 'preflop') {
    advancePhase(state);
    console.log(`\n  Flop: phase=${state.phase}, community=${state.communityCards.map(c=>c.code)}`);

    for (let i = 0; i < 3; i++) {
      const actor = state.players[state.currentPlayerIndex];
      console.log(`  Flop action ${i+1}: ${actor.userId} checks`);
      const result = processAction(state, actor.userId, 'check');
      console.log(`    phaseComplete=${result.phaseComplete}`, stateSnapshot(state));
      if (result.phaseComplete) {
        if (i < 2) {
          console.log(`    *** Early completion at flop action ${i+1}! Expected 3 actions.`);
          bugs.push({ test: 'Test 7 (3-player flop)', details: `Round ended after only ${i+1} actions` });
        }
        break;
      }
    }
    assert(state.phase === 'flop', 'Still in flop (not auto-advanced yet)');
  }

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 7: ${e.message}`);
  bugs.push({ test: 'Test 7 (3-player game)', details: `Exception: ${e.message}` });
}

// ─── TEST 8: numActorsThisRound reset after all-in ───────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 8: numActorsThisRound — verify preflop blind logic');
console.log('══════════════════════════════════════════════════════════════');

try {
  // Key question: after startHand, numActorsThisRound = 0
  // After SB acts (call), numActorsThisRound = 1
  // After BB acts (check), numActorsThisRound = 2
  // active.length = 2
  // So isBettingRoundComplete should return true — which is correct
  // But what if BB tries to raise? Then SB must act again.
  // After BB raises, numActorsThisRound = 2, but SB hasn't responded.
  // isBettingRoundComplete: bets not equal → false. Correct.
  // After SB calls, numActorsThisRound = 3 >= 2 active, bets equal → true. Correct.

  const state = startHand('g8', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log(`\n  Initial numActorsThisRound: ${state.numActorsThisRound}`);
  assert(state.numActorsThisRound === 0, 'numActorsThisRound starts at 0');

  const actor1 = state.players[state.currentPlayerIndex];
  processAction(state, actor1.userId, 'call');
  console.log(`  After first call: numActorsThisRound=${state.numActorsThisRound}`);
  assert(state.numActorsThisRound === 1, 'numActorsThisRound=1 after first action');

  const actor2 = state.players[state.currentPlayerIndex];
  const result = processAction(state, actor2.userId, 'check');
  console.log(`  After BB check: numActorsThisRound=${state.numActorsThisRound}, phaseComplete=${result.phaseComplete}`);
  assert(result.phaseComplete, 'Phase complete after BB checks');

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 8: ${e.message}`);
  bugs.push({ test: 'Test 8 (numActorsThisRound)', details: `Exception: ${e.message}` });
}

// ─── TEST 9: All-in response — correct actor after all-in ────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 9: All-in mid-street — correct response actor tracking');
console.log('══════════════════════════════════════════════════════════════');

try {
  // Post-flop: 3 players, first checks, second goes all-in, third should get to respond,
  // then first (who checked) should also get to respond
  const state = startHand('g9', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 },
     { userId: 'Carol', seatNumber: 3, stack: 500 }],
    1, 5, 10
  );

  // Get everyone to flop: UTG calls, SB calls, BB checks
  // Let's trace who is who: dealer=1, SB=2, BB=3, UTG=1
  const sbP = state.players.find(p => p.currentBet === 5);
  const bbP = state.players.find(p => p.currentBet === 10);
  console.log(`  SB: ${sbP?.userId}, BB: ${bbP?.userId}`);

  // Preflop: UTG (seat 1 = Alice after dealer=1... wait)
  // dealer=seat1=Alice; SB=next after 1 = seat2=Bob; BB=next after 2 = seat3=Carol
  // UTG = next after BB = seat1=Alice
  console.log(`  First preflop actor: ${state.players[state.currentPlayerIndex].userId}`);

  // All call preflop (UTG, SB, BB option)
  let a = state.players[state.currentPlayerIndex];
  processAction(state, a.userId, 'call'); // UTG calls
  a = state.players[state.currentPlayerIndex];
  processAction(state, a.userId, 'call'); // SB calls
  a = state.players[state.currentPlayerIndex];
  const preflopResult = processAction(state, a.userId, 'check'); // BB checks

  console.log(`  Preflop complete: ${preflopResult.phaseComplete}`);
  assert(preflopResult.phaseComplete, '3-player preflop completes after 3 actions');

  // Deal flop
  advancePhase(state);
  console.log(`\n  Flop: ${state.communityCards.map(c=>c.code)}, first actor: ${state.players[state.currentPlayerIndex].userId}`);

  // First player checks
  const flopP1 = state.players[state.currentPlayerIndex];
  console.log(`  ${flopP1.userId} checks`);
  let r = processAction(state, flopP1.userId, 'check');
  console.log(`  phaseComplete=${r.phaseComplete}`, stateSnapshot(state));

  // Second player goes all-in
  const flopP2 = state.players[state.currentPlayerIndex];
  console.log(`  ${flopP2.userId} goes all-in (stack=${flopP2.stack})`);
  r = processAction(state, flopP2.userId, 'all-in');
  console.log(`  phaseComplete=${r.phaseComplete}`, stateSnapshot(state));
  assert(!r.phaseComplete, 'Not done after 1 all-in (others can still respond)');

  // Third player (Carol, short-stack) should respond
  const flopP3 = state.players[state.currentPlayerIndex];
  console.log(`  ${flopP3.userId} should respond to all-in`);
  assert(flopP3.userId !== flopP2.userId, 'Different player responds to all-in');

  r = processAction(state, flopP3.userId, 'call');
  console.log(`  phaseComplete=${r.phaseComplete}`, stateSnapshot(state));

  // Now flopP1 who checked must also get to respond (if not phaseComplete yet)
  if (!r.phaseComplete) {
    const respondingActor = state.players[state.currentPlayerIndex];
    console.log(`  ${respondingActor.userId} responds (was the checker)`);
    assert(respondingActor.userId === flopP1.userId, 'Original checker must respond to all-in raise');
    r = processAction(state, respondingActor.userId, 'call');
    console.log(`  phaseComplete=${r.phaseComplete}`, stateSnapshot(state));
  }

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 9: ${e.message}`);
  bugs.push({ test: 'Test 9 (all-in mid-street)', details: `Exception: ${e.message}` });
}

// ─── TEST 10: advancePhase from river should throw ────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 10: advancePhase from river should throw an error');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g10', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  // Fast-forward to river
  advancePhase(state); // flop
  advancePhase(state); // turn
  advancePhase(state); // river

  assert(state.phase === 'river', 'Reached river');

  try {
    advancePhase(state);
    assert(false, 'advancePhase from river should throw', 'No error thrown!');
    bugs.push({ test: 'Test 10 (advance from river)', details: 'advancePhase from river did NOT throw an error as expected' });
  } catch (innerE) {
    assert(true, `advancePhase from river throws: "${innerE.message}"`);
  }

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 10: ${e.message}`);
  bugs.push({ test: 'Test 10 (advance from river)', details: `Exception: ${e.message}` });
}

// ─── TEST 11: Raise math — lastRaiseAmount calculation ───────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 11: Raise math — lastRaiseAmount after a raise');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g11', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 1000 },
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  const firstActor = state.players[state.currentPlayerIndex];
  // firstActor is SB, posted 5, needs to call 5 more or raise
  // Raises to 30 total (currentBet = 5, toAdd = 30 - 5 = 25, callAmount = 10-5=5, lastRaiseAmount = 25-5 = 20)
  console.log(`\n  Before raise: lastRaiseAmount=${state.lastRaiseAmount}, firstActor bet=${firstActor.currentBet}`);

  processAction(state, firstActor.userId, 'raise', 30);
  console.log(`  After raise to 30: lastRaiseAmount=${state.lastRaiseAmount}, currentBet=${state.currentBet}`);

  // lastRaiseAmount should be 20 (raise was 20 above the call)
  assert(state.lastRaiseAmount === 20, `lastRaiseAmount is 20 after raise to 30 (call was 5, raise increment = 20)`, `got ${state.lastRaiseAmount}`);
  assert(state.currentBet === 30, `currentBet is 30 after raise`, `got ${state.currentBet}`);

  // Caller (BB) calls 30
  const caller = state.players[state.currentPlayerIndex];
  console.log(`  BB (${caller.userId}) calls 30`);
  processAction(state, caller.userId, 'call');
  console.log(`  pot=${state.pot}`);
  assert(state.pot === 60, `Pot is 60 after both put in 30`, `pot=${state.pot}`);

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 11: ${e.message}`);
  bugs.push({ test: 'Test 11 (raise math)', details: `Exception: ${e.message}` });
}

// ─── TEST 12: Preflop — SB going all-in with less than BB ────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('TEST 12: Short-stack SB forced all-in (stack < BB)');
console.log('══════════════════════════════════════════════════════════════');

try {
  const state = startHand('g12', 't1',
    [{ userId: 'Alice', seatNumber: 1, stack: 7 },   // SB, can't cover BB of 10
     { userId: 'Bob',   seatNumber: 2, stack: 1000 }],
    1, 5, 10
  );

  console.log('\n  After startHand:', stateSnapshot(state));

  // Alice (SB, seat1) posts 5; Bob (BB, seat2) posts 10
  // Alice has 2 left after posting SB (7-5=2)
  const alice = state.players.find(p => p.userId === 'Alice');
  const bob = state.players.find(p => p.userId === 'Bob');
  console.log(`  Alice: stack=${alice?.stack}, bet=${alice?.currentBet}, allIn=${alice?.isAllIn}`);
  console.log(`  Bob: stack=${bob?.stack}, bet=${bob?.currentBet}, allIn=${bob?.isAllIn}`);

  assert(alice?.stack === 2, 'Alice has 2 chips left after posting SB of 5');

  // Alice is UTG, can call (2 more) or fold
  const firstActor = state.players[state.currentPlayerIndex];
  console.log(`  First actor: ${firstActor.userId}`);

  // Alice goes all-in with remaining 2 chips
  let r = processAction(state, firstActor.userId, 'all-in');
  console.log(`  After Alice all-in:`, stateSnapshot(state));
  console.log(`  phaseComplete=${r.phaseComplete}`);

  assert(!r.phaseComplete, 'Not done after Alice all-in — Bob must respond');
  assert(alice?.isAllIn === true, 'Alice is all-in');
  assert(alice?.stack === 0, 'Alice has 0 stack');

  // Bob responds
  const bobActor = state.players[state.currentPlayerIndex];
  assert(bobActor.userId === 'Bob', 'Bob is next to act');
  r = processAction(state, 'Bob', 'call');
  console.log(`  After Bob calls:`, stateSnapshot(state));
  assert(r.phaseComplete, 'Phase complete after Bob calls short-stack all-in');

} catch (e) {
  console.log(`  ✗ EXCEPTION in Test 12: ${e.message}`);
  bugs.push({ test: 'Test 12 (short-stack all-in)', details: `Exception: ${e.message}` });
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('FINAL SUMMARY');
console.log('══════════════════════════════════════════════════════════════');
console.log(`\nTotal PASS: ${passCount}`);
console.log(`Total FAIL: ${failCount}`);

if (bugs.length === 0) {
  console.log('\nNo bugs found! All tests passed.');
} else {
  console.log(`\n${bugs.length} BUG(S) FOUND:\n`);
  bugs.forEach((bug, i) => {
    console.log(`Bug #${i+1}: [${bug.test}]`);
    console.log(`  Details: ${bug.details}`);
  });
}
