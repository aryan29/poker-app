'use client';

import { useEffect, useState, useCallback } from 'react';
import type { WinnerResult } from '@/types';
import { Card } from './Card';

interface Props {
  winners: WinnerResult[];
  losers?: Array<{ userId: string; amount: number }>;
  playerCards?: Record<string, string[]>;
  /** True when the hand was won uncontested (everyone else folded). Hides hand rank
   *  and hole cards in the modal — real poker rule: winner doesn't have to show. */
  uncontested?: boolean;
  seats: Array<{ user_id: string; profile: { display_name: string } }>;
  isHost: boolean;
  onPlayAgain: () => void;
  onDismiss: () => void;
}

const HAND_RANK_LABELS: Record<string, string> = {
  'high-card': 'High Card',
  pair: 'One Pair',
  'two-pair': 'Two Pair',
  'three-of-a-kind': 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  'full-house': 'Full House',
  'four-of-a-kind': 'Four of a Kind',
  'straight-flush': 'Straight Flush',
  'royal-flush': 'Royal Flush',
};

export function GameResultModal({
  winners,
  losers = [],
  playerCards = {},
  uncontested = false,
  seats,
  isHost,
  onPlayAgain,
  onDismiss,
}: Props) {
  const [countdown, setCountdown] = useState(8);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (countdown <= 0) {
      dismiss();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, dismiss]);

  const getPlayerName = (userId: string) => {
    return seats.find((s) => s.user_id === userId)?.profile.display_name ?? 'Unknown';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          border: '1px solid rgba(251,191,36,0.3)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Gold shimmer header */}
        <div
          className="px-8 pt-8 pb-4 text-center"
          style={{
            background:
              'linear-gradient(180deg, rgba(251,191,36,0.15) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(251,191,36,0.15)',
          }}
        >
          <div className="text-5xl mb-2">
            {winners.length === 1 ? '🏆' : '🤝'}
          </div>
          <h2
            className="text-2xl font-black tracking-tight"
            style={{
              color: '#fbbf24',
              textShadow: '0 0 20px rgba(251,191,36,0.5)',
            }}
          >
            {winners.length === 1 ? 'Winner!' : 'Split Pot!'}
          </h2>
        </div>

        {/* Winners list */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {winners.map((winner, i) => {
            const name = getPlayerName(winner.userId);
            const handLabel =
              HAND_RANK_LABELS[winner.handResult.rank] ?? winner.handResult.rank;
            return (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #92400e)',
                    boxShadow: '0 4px 12px rgba(217,119,6,0.4)',
                    color: '#fef3c7',
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg leading-tight truncate">
                    {name}
                  </p>
                  {uncontested ? (
                    <p className="text-yellow-400/70 text-sm">Won uncontested</p>
                  ) : (
                    <>
                      <p className="text-yellow-400/70 text-sm">{handLabel}</p>
                      {winner.handResult.description && (
                        <p className="text-gray-500 text-xs mt-0.5 truncate">
                          {winner.handResult.description}
                        </p>
                      )}
                      {/* Hole cards — only when there was an actual showdown */}
                      {playerCards[winner.userId] && (
                        <div className="flex gap-1 mt-1.5">
                          {playerCards[winner.userId].map((code) => (
                            <Card key={code} card={code} size="sm" />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amount won */}
                <div className="flex flex-col items-end">
                  <span className="text-emerald-400 font-black text-xl">
                    +{winner.amount.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-xs">chips</span>
                </div>
              </div>
            );
          })}

          {/* Losers list */}
          {losers.length > 0 && (
            <>
              <div className="border-t border-white/5 pt-2" />
              {losers.map((loser, i) => {
                const name = getPlayerName(loser.userId);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-2xl"
                    style={{
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.15)',
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                        color: '#fca5a5',
                      }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + cards */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-lg leading-tight truncate">
                        {name}
                      </p>
                      {playerCards[loser.userId] && (
                        <div className="flex gap-1 mt-1.5">
                          {playerCards[loser.userId].map((code) => (
                            <Card key={code} card={code} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Amount lost */}
                    <div className="flex flex-col items-end">
                      <span className="text-red-400 font-black text-xl">
                        {loser.amount.toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-xs">chips</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Actions */}
        <div
          className="px-6 pb-6 flex flex-col gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {isHost && (
            <button
              onClick={onPlayAgain}
              className="w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #15803d, #166534)',
                border: '1px solid rgba(52,211,153,0.3)',
                boxShadow: '0 4px 16px rgba(21,128,61,0.3)',
              }}
            >
              Play Again
            </button>
          )}
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400 transition-all hover:text-gray-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Dismiss ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
}
