'use client';

import { Card } from './Card';
import type { GamePhase } from '@/types';

interface Props {
  cards: string[];
  phase: GamePhase;
  pot?: number;
}

const PHASE_CARD_COUNT: Record<GamePhase, number> = {
  waiting: 0,
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

export function CommunityCards({ cards, phase, pot }: Props) {
  const visibleCount = PHASE_CARD_COUNT[phase] ?? 0;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Pot display */}
      {pot !== undefined && pot > 0 && (
        <div
          className="flex items-center gap-1.5 px-4 py-1 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(251,191,36,0.4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {/* Chip icon */}
          <div className="relative w-4 h-4">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(#ef4444 0deg 90deg, #fbbf24 90deg 180deg, #3b82f6 180deg 270deg, #22c55e 270deg 360deg)',
              }}
            />
            <div className="absolute inset-0.5 rounded-full bg-gray-900/70" />
          </div>
          <span className="text-yellow-400 text-sm font-bold tracking-wide">
            POT: {pot.toLocaleString()}
          </span>
        </div>
      )}

      {/* Cards row */}
      <div className="flex gap-2 items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const revealed = i < visibleCount && cards[i];
          return (
            <div
              key={i}
              className={`transition-all duration-500 ${
                i < visibleCount ? 'opacity-100 scale-100' : 'opacity-40 scale-95'
              }`}
            >
              {revealed ? (
                <Card card={cards[i]} size="md" />
              ) : (
                <EmptySlot />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      className="w-12 h-[4.2rem] rounded-lg flex-shrink-0"
      style={{
        border: '2px dashed rgba(255,255,255,0.15)',
        background: 'rgba(0,0,0,0.2)',
      }}
    />
  );
}
