import type { Card, Rank, Suit } from '@/types';

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'] as unknown as Suit[];

// Internal suit codes for storage ('c','d','h','s')
const SUIT_CODES: Suit[] = ['c', 'd', 'h', 's'];

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/** Create an unshuffled 52-card deck */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUIT_CODES) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle — mutates and returns the same array */
export function shuffleDeck<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Create a fresh shuffled 52-card deck */
export function createShuffledDeck(): Card[] {
  return shuffleDeck(createDeck());
}

/** Encode deck as a comma-separated string of card codes */
export function encodeDeck(deck: Card[]): string {
  return deck.map((c) => c.code).join(',');
}

/** Decode a deck string back to Card objects */
export function decodeDeck(deckStr: string): Card[] {
  if (!deckStr) return [];
  return deckStr.split(',').map(stringToCard);
}

/** Convert a Card to its string code representation (e.g. "Ah", "Kd") */
export function cardToString(card: Card): string {
  return card.code;
}

/** Parse a card code string (e.g. "Ah", "Tc") back to a Card object */
export function stringToCard(code: string): Card {
  const rank = code.slice(0, -1) as Rank;
  const suit = code.slice(-1) as Suit;
  return { rank, suit, code };
}

/** Alias for stringToCard — used by existing route files */
export const parseCard = stringToCard;
