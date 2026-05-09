'use client';

import { Card } from './Card';
import type { GamePhase } from '@/types';

interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}

interface Props {
  cards: string[];
  phase: GamePhase;
  pot?: number;
  roundPot?: number;
  sidePots?: SidePot[];
}

const PHASE_CARD_COUNT: Record<GamePhase, number> = {
  waiting: 0,
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

export function CommunityCards({ cards, phase, pot, roundPot, sidePots }: Props) {
  const visibleCount = PHASE_CARD_COUNT[phase] ?? 0;
  const committedPot = (pot ?? 0) - (roundPot ?? 0);
  const hasMultiplePots = sidePots && sidePots.length > 1;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Pot display */}
      {pot !== undefined && pot > 0 && (
        <div className="flex flex-col items-center gap-1">
          {/* Main pot chip */}
          <div
            className="flex items-center gap-1.5 px-4 py-1 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(251,191,36,0.4)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
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

          {/* Round bets indicator — shown when there are active bets this round */}
          {roundPot !== undefined && roundPot > 0 && committedPot > 0 && (
            <div
              className="flex items-center gap-1 px-3 py-0.5 rounded-full text-xs"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#93c5fd',
              }}
            >
              <span>{committedPot.toLocaleString()} committed</span>
              <span style={{ color: 'rgba(147,197,253,0.5)' }}>+</span>
              <span className="font-semibold text-blue-300">{roundPot.toLocaleString()} this round</span>
            </div>
          )}

          {/* Side pots — shown when 2+ players are all-in with unequal stacks */}
          {hasMultiplePots && (
            <div className="flex flex-col items-center gap-0.5 mt-0.5">
              {sidePots.map((sp, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    color: '#c4b5fd',
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{i === 0 ? 'Main' : `Side ${i}`} pot:</span>
                  <span className="font-semibold">{sp.amount.toLocaleString()}</span>
                  <span style={{ opacity: 0.5 }}>({sp.eligiblePlayers.length} eligible)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards row — scale down on small screens to fit 5 cards */}
      <div className="flex gap-1 sm:gap-2 items-center">
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
                <Card card={cards[i]} size="sm" />
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
      className="w-8 h-12 rounded-lg flex-shrink-0"
      style={{
        border: '2px dashed rgba(255,255,255,0.15)',
        background: 'rgba(0,0,0,0.2)',
      }}
    />
  );
}
