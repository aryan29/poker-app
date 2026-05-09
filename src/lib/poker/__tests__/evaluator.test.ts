import { describe, it, expect } from 'vitest';
import { evaluateHand } from '../evaluator';

describe('evaluateHand', () => {
  it('throws if fewer than 5 cards', () => {
    expect(() => evaluateHand(['Ah', 'Kd', 'Qc'])).toThrow();
    expect(() => evaluateHand(['Ah', 'Kd', 'Qc', 'Jh'])).toThrow();
  });

  it('detects pair from 5 cards (flop scenario: 2 hole + 3 community)', () => {
    // Hole: Ah Kd  Community: As 2c 7h  → Pair of Aces
    const result = evaluateHand(['Ah', 'Kd', 'As', '2c', '7h']);
    expect(result.rank).toBe('pair');
    expect(result.description).toMatch(/Ace/i);
  });

  it('detects two-pair from 6 cards (turn scenario: 2 hole + 4 community)', () => {
    // Hole: Ah Kd  Community: As Kh 2c 7h  → Two Pair, Aces and Kings
    const result = evaluateHand(['Ah', 'Kd', 'As', 'Kh', '2c', '7h']);
    expect(result.rank).toBe('two-pair');
    expect(result.description).toMatch(/Ace/i);
    expect(result.description).toMatch(/King/i);
  });

  it('detects flush from 7 cards (river scenario: 2 hole + 5 community)', () => {
    // Hole: Ah 2h  Community: 5h 8h Jh Kd 3s  → Flush in hearts (best 5: Ah Jh 8h 5h 2h)
    const result = evaluateHand(['Ah', '2h', '5h', '8h', 'Jh', 'Kd', '3s']);
    expect(result.rank).toBe('flush');
  });

  it('picks best 5-card hand from 7 cards', () => {
    // Hole: Ah Kh  Community: Qh Jh Th 2c 3d  → Royal Flush (A K Q J T all hearts)
    const result = evaluateHand(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']);
    expect(result.rank).toBe('royal-flush');
    expect(result.description).toBe('Royal Flush');
  });

  it('detects three-of-a-kind from 5 cards', () => {
    // Hole: As Ad  Community: Ah 2c 7d  → Three of a Kind, Aces
    const result = evaluateHand(['As', 'Ad', 'Ah', '2c', '7d']);
    expect(result.rank).toBe('three-of-a-kind');
    expect(result.description).toMatch(/Ace/i);
  });

  it('detects straight from 5 cards', () => {
    // 5-6-7-8-9 straight
    const result = evaluateHand(['5h', '6d', '7c', '8s', '9h']);
    expect(result.rank).toBe('straight');
    expect(result.description).toMatch(/Nine/i);
  });

  it('detects full house from 6 cards', () => {
    // Hole: Ah As  Community: Ad Kh Ks 2c  → Full House, Aces full of Kings
    const result = evaluateHand(['Ah', 'As', 'Ad', 'Kh', 'Ks', '2c']);
    expect(result.rank).toBe('full-house');
    expect(result.description).toMatch(/Ace/i);
    expect(result.description).toMatch(/King/i);
  });

  it('detects four-of-a-kind from 7 cards', () => {
    // Hole: Ah As  Community: Ad Ac Kh Ks 2c  → Four of a Kind, Aces
    const result = evaluateHand(['Ah', 'As', 'Ad', 'Ac', 'Kh', 'Ks', '2c']);
    expect(result.rank).toBe('four-of-a-kind');
    expect(result.description).toMatch(/Ace/i);
  });

  it('detects high card when no made hand', () => {
    // 2 3 5 7 9 offsuit — no pair, no straight, no flush
    const result = evaluateHand(['2h', '3d', '5c', '7s', '9h']);
    expect(result.rank).toBe('high-card');
    expect(result.description).toMatch(/Nine/i);
  });

  it('detects wheel straight (A-2-3-4-5)', () => {
    const result = evaluateHand(['Ah', '2d', '3c', '4s', '5h']);
    expect(result.rank).toBe('straight');
    // High card of wheel is 5
    expect(result.description).toMatch(/Five/i);
  });

  it('detects straight-flush', () => {
    // 5-6-7-8-9 of hearts
    const result = evaluateHand(['5h', '6h', '7h', '8h', '9h']);
    expect(result.rank).toBe('straight-flush');
    expect(result.description).toMatch(/Nine/i);
  });
});
