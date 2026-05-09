import type { Card, HandRank, HandResult, WinnerResult } from '@/types';
import { RANK_VALUE } from './deck';

// ─── Hand rank numeric values ─────────────────────────────────────────────────

const HAND_RANK_VALUE: Record<HandRank, number> = {
  'high-card': 1,
  'pair': 2,
  'two-pair': 3,
  'three-of-a-kind': 4,
  'straight': 5,
  'flush': 6,
  'full-house': 7,
  'four-of-a-kind': 8,
  'straight-flush': 9,
  'royal-flush': 10,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardValue(card: Card): number {
  return RANK_VALUE[card.rank];
}

function sortDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a));
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of cards) {
    const v = cardValue(card);
    const group = map.get(v) ?? [];
    group.push(card);
    map.set(v, group);
  }
  return map;
}

function isStraight(cards: Card[]): { is: true; high: number } | { is: false } {
  const sorted = sortDesc(cards);
  const values = sorted.map(cardValue);

  // Normal straight
  let normal = true;
  for (let i = 0; i < 4; i++) {
    if (values[i] - values[i + 1] !== 1) { normal = false; break; }
  }
  if (normal) return { is: true, high: values[0] };

  // Wheel: A-2-3-4-5
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    return { is: true, high: 5 };
  }

  return { is: false };
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

function rankLabel(value: number): string {
  const map: Record<number, string> = {
    14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack',
    10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven',
    6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
  };
  return map[value] ?? String(value);
}

// ─── Generate all 5-card combinations from N cards ───────────────────────────

function combinations(cards: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── Evaluate a single 5-card hand ───────────────────────────────────────────

function evaluate5(cards: Card[]): HandResult {
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

  // Royal Flush
  if (flush && straightResult.is && straightResult.high === 14) {
    return {
      rank: 'royal-flush',
      rankValue: HAND_RANK_VALUE['royal-flush'],
      tiebreakers: [14],
      cards: sorted,
      description: 'Royal Flush',
    };
  }

  // Straight Flush
  if (flush && straightResult.is) {
    return {
      rank: 'straight-flush',
      rankValue: HAND_RANK_VALUE['straight-flush'],
      tiebreakers: [straightResult.high],
      cards: sorted,
      description: `Straight Flush, ${rankLabel(straightResult.high)} high`,
    };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    const quad = groupEntries[0][0];
    const kicker = groupEntries[1][0];
    return {
      rank: 'four-of-a-kind',
      rankValue: HAND_RANK_VALUE['four-of-a-kind'],
      tiebreakers: [quad, kicker],
      cards: sorted,
      description: `Four of a Kind, ${rankLabel(quad)}s`,
    };
  }

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    const trips = groupEntries[0][0];
    const pair = groupEntries[1][0];
    return {
      rank: 'full-house',
      rankValue: HAND_RANK_VALUE['full-house'],
      tiebreakers: [trips, pair],
      cards: sorted,
      description: `Full House, ${rankLabel(trips)}s full of ${rankLabel(pair)}s`,
    };
  }

  // Flush
  if (flush) {
    return {
      rank: 'flush',
      rankValue: HAND_RANK_VALUE['flush'],
      tiebreakers: values,
      cards: sorted,
      description: `Flush, ${rankLabel(values[0])} high`,
    };
  }

  // Straight
  if (straightResult.is) {
    return {
      rank: 'straight',
      rankValue: HAND_RANK_VALUE['straight'],
      tiebreakers: [straightResult.high],
      cards: sorted,
      description: `Straight, ${rankLabel(straightResult.high)} high`,
    };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    const trips = groupEntries[0][0];
    const kickers = groupEntries.slice(1).map(([v]) => v);
    return {
      rank: 'three-of-a-kind',
      rankValue: HAND_RANK_VALUE['three-of-a-kind'],
      tiebreakers: [trips, ...kickers],
      cards: sorted,
      description: `Three of a Kind, ${rankLabel(trips)}s`,
    };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const high = groupEntries[0][0];
    const low = groupEntries[1][0];
    const kicker = groupEntries[2][0];
    return {
      rank: 'two-pair',
      rankValue: HAND_RANK_VALUE['two-pair'],
      tiebreakers: [high, low, kicker],
      cards: sorted,
      description: `Two Pair, ${rankLabel(high)}s and ${rankLabel(low)}s`,
    };
  }

  // Pair
  if (counts[0] === 2) {
    const pair = groupEntries[0][0];
    const kickers = groupEntries.slice(1).map(([v]) => v);
    return {
      rank: 'pair',
      rankValue: HAND_RANK_VALUE['pair'],
      tiebreakers: [pair, ...kickers],
      cards: sorted,
      description: `Pair of ${rankLabel(pair)}s`,
    };
  }

  // High Card
  return {
    rank: 'high-card',
    rankValue: HAND_RANK_VALUE['high-card'],
    tiebreakers: values,
    cards: sorted,
    description: `High Card, ${rankLabel(values[0])}`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * evaluateHand accepts an array of card code strings (e.g. ["Ah","Kd","Tc","2c","3s"]).
 * The array must have at least 5 cards; if more, picks the best 5-card combo.
 */
export function evaluateHand(cards: string[]): HandResult {
  const parsed: Card[] = cards.map((code) => {
    const rank = code.slice(0, -1) as Card['rank'];
    const suit = code.slice(-1) as Card['suit'];
    return { rank, suit, code };
  });
  if (parsed.length < 5) {
    throw new Error(`Need at least 5 cards, got ${parsed.length}`);
  }
  const combos = combinations(parsed, 5);
  let best: HandResult | null = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best!;
}

/**
 * Compare two hand results.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Find winner(s) from an array of { userId, cards } where cards is an
 * array of card code strings (2 hole + 5 community = 7 total).
 * Returns an array to handle ties.
 */
export function findWinners(
  hands: Array<{ userId: string; cards: string[] }>
): Array<{ userId: string; handResult: HandResult }> {
  const results = hands.map(({ userId, cards }) => ({
    userId,
    handResult: evaluateHand(cards),
  }));

  results.sort((a, b) => compareHands(b.handResult, a.handResult));

  const best = results[0].handResult;
  return results.filter((r) => compareHands(r.handResult, best) === 0);
}

/**
 * Determine winners with WinnerResult including pot split amounts.
 * Used internally by the game engine.
 */
export function determineWinnersWithPot(
  players: Array<{ userId: string; holeCards: Card[] }>,
  communityCards: Card[],
  pot: number
): WinnerResult[] {
  const hands = players.map(({ userId, holeCards }) => ({
    userId,
    cards: [...holeCards, ...communityCards].map((c) => c.code),
  }));
  const winners = findWinners(hands);
  const amountEach = Math.floor(pot / winners.length);
  return winners.map((w) => ({
    userId: w.userId,
    handResult: w.handResult,
    amount: amountEach,
  }));
}
