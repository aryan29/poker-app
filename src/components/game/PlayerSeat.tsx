'use client';

import type { TableSeat, Profile, PlayerHand } from '@/types';
import { Card } from './Card';

interface Props {
  seat: (TableSeat & { profile: Profile }) | undefined;
  seatNumber: number;
  isCurrentPlayer: boolean;
  isDealer: boolean;
  isMe: boolean;
  myHand: PlayerHand | null;
  isFolded?: boolean;
  revealedCards?: string[];
  isSB?: boolean;
  isBB?: boolean;
}

const AVATAR_COLORS = [
  '#7c3aed', '#0369a1', '#b45309', '#065f46', '#9f1239',
  '#1e40af', '#92400e', '#14532d', '#831843', '#4c1d95',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function ChipStack({ amount, highlight }: { amount: number; highlight?: boolean }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all"
      style={{
        background: highlight ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.6)',
        border: highlight ? '1px solid rgba(251,191,36,0.7)' : '1px solid rgba(251,191,36,0.35)',
        color: highlight ? '#fde68a' : '#fbbf24',
        boxShadow: highlight ? '0 0 8px rgba(251,191,36,0.3)' : '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{
          background: 'conic-gradient(#ef4444 0deg 90deg, #fbbf24 90deg 180deg, #3b82f6 180deg 270deg, #22c55e 270deg 360deg)',
        }}
      />
      {amount.toLocaleString()}
    </div>
  );
}

export function PlayerSeat({
  seat,
  seatNumber,
  isCurrentPlayer,
  isDealer,
  isMe,
  myHand,
  isFolded,
  revealedCards,
  isSB,
  isBB,
}: Props) {
  // Empty seat
  if (!seat) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
          style={{
            border: '2px dashed rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <span className="text-gray-700 text-xs font-mono">{seatNumber}</span>
        </div>
      </div>
    );
  }

  const folded = isFolded ?? myHand?.is_folded;
  const avatarColor = AVATAR_COLORS[(seatNumber - 1) % AVATAR_COLORS.length];
  const hasBet = myHand && myHand.current_bet > 0;
  const showCards = !folded && (myHand || (revealedCards && revealedCards.length > 0));

  return (
    <div
      className={`relative flex flex-col items-center gap-0.5 transition-all duration-300 ${
        folded ? 'opacity-35 scale-95' : 'opacity-100'
      }`}
    >
      {/* Dealer button — white chip */}
      {isDealer && (
        <div
          className="absolute -top-3 -right-3 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: 'linear-gradient(135deg, #ffffff, #d1d5db)',
            border: '2px solid #6b7280',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <span className="text-gray-800 font-black" style={{ fontSize: '9px' }}>D</span>
        </div>
      )}

      {/* SB badge */}
      {isSB && (
        <div
          className="absolute -top-3 -left-3 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            border: '1.5px solid rgba(14,165,233,0.6)',
            boxShadow: '0 2px 8px rgba(2,132,199,0.5)',
          }}
        >
          <span className="text-white font-black" style={{ fontSize: '8px' }}>SB</span>
        </div>
      )}

      {/* BB badge */}
      {isBB && (
        <div
          className="absolute -top-7 -right-3 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: '1.5px solid rgba(245,158,11,0.6)',
            boxShadow: '0 2px 8px rgba(217,119,6,0.5)',
          }}
        >
          <span className="text-white font-black" style={{ fontSize: '8px' }}>BB</span>
        </div>
      )}

      {/* Hole cards — fanned above avatar */}
      {showCards && (
        <div className="relative flex items-end justify-center mb-0.5" style={{ height: 44, width: 52 }}>
          {(() => {
            const cards =
              revealedCards && revealedCards.length > 0
                ? revealedCards
                : isMe && myHand && myHand.hole_cards.length > 0
                ? myHand.hole_cards
                : null;

            if (cards) {
              return cards.map((code, i) => (
                <div
                  key={code}
                  className="absolute bottom-0 transition-all duration-300"
                  style={{
                    transform: `rotate(${(i - (cards.length - 1) / 2) * 8}deg) translateY(${i === 0 ? '2px' : '-2px'})`,
                    left: i === 0 ? '2px' : 'auto',
                    right: i === 1 ? '2px' : 'auto',
                    zIndex: i + 1,
                    filter: isCurrentPlayer ? 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' : 'none',
                  }}
                >
                  <Card card={code} size="sm" />
                </div>
              ));
            }

            // Face-down cards for other active players
            return [0, 1].map((i) => (
              <div
                key={i}
                className="absolute bottom-0"
                style={{
                  transform: `rotate(${(i - 0.5) * 8}deg) translateY(${i === 0 ? '2px' : '-2px'})`,
                  left: i === 0 ? '2px' : 'auto',
                  right: i === 1 ? '2px' : 'auto',
                  zIndex: i + 1,
                }}
              >
                <Card faceDown size="sm" />
              </div>
            ));
          })()}
        </div>
      )}

      {/* Active player — outer pulse ring */}
      {isCurrentPlayer && (
        <>
          <div
            className="absolute rounded-full animate-ping"
            style={{
              inset: '-6px',
              background: 'transparent',
              border: '2px solid rgba(251,191,36,0.6)',
              animationDuration: '1.2s',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: '-4px',
              border: '2px solid rgba(251,191,36,0.25)',
            }}
          />
        </>
      )}

      {/* Avatar */}
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white transition-all duration-300"
        style={{
          background: `linear-gradient(145deg, ${avatarColor}ee, ${avatarColor}88)`,
          border: isCurrentPlayer
            ? '2.5px solid #fbbf24'
            : isMe
            ? '2.5px solid #34d399'
            : '2px solid rgba(255,255,255,0.15)',
          boxShadow: isCurrentPlayer
            ? `0 0 20px rgba(251,191,36,0.6), 0 0 8px rgba(251,191,36,0.3), 0 4px 12px rgba(0,0,0,0.6)`
            : isMe
            ? '0 0 14px rgba(52,211,153,0.35), 0 4px 10px rgba(0,0,0,0.5)'
            : '0 4px 10px rgba(0,0,0,0.5)',
        }}
      >
        <span className="drop-shadow-sm select-none">{getInitials(seat.profile.display_name)}</span>

        {/* All-in badge */}
        {seat.status === 'all_in' && (
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded text-white font-black whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              fontSize: '8px',
              boxShadow: '0 1px 6px rgba(239,68,68,0.6)',
              letterSpacing: '0.05em',
            }}
          >
            ALL IN
          </div>
        )}
      </div>

      {/* Player name + stack */}
      <div
        className="flex flex-col items-center px-2 py-0.5 rounded-lg transition-all"
        style={{
          background: isCurrentPlayer ? 'rgba(251,191,36,0.08)' : 'rgba(0,0,0,0.55)',
          border: isCurrentPlayer
            ? '1px solid rgba(251,191,36,0.2)'
            : '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span
          className={`text-xs font-semibold truncate max-w-[72px] ${
            isMe ? 'text-emerald-300' : isCurrentPlayer ? 'text-yellow-200' : 'text-gray-200'
          }`}
        >
          {seat.profile.display_name}
        </span>
        <ChipStack amount={seat.stack} highlight={isCurrentPlayer} />
      </div>

      {/* Current bet */}
      {hasBet && (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(217,119,6,0.9), rgba(146,64,14,0.9))',
            color: '#fef3c7',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            fontSize: '10px',
            border: '1px solid rgba(251,191,36,0.3)',
          }}
        >
          ↑ {myHand.current_bet.toLocaleString()}
        </div>
      )}

      {/* YOUR TURN indicator */}
      {isCurrentPlayer && (
        <div
          className="mt-0.5 px-3 py-0.5 rounded-full font-black animate-bounce"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#1c1917',
            fontSize: '9px',
            boxShadow: '0 0 12px rgba(251,191,36,0.5), 0 2px 6px rgba(0,0,0,0.4)',
            letterSpacing: '0.08em',
          }}
        >
          ▶ YOUR TURN
        </div>
      )}

      {/* Folded */}
      {folded && (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full font-bold"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#4b5563',
            fontSize: '9px',
            letterSpacing: '0.06em',
          }}
        >
          FOLDED
        </div>
      )}
    </div>
  );
}
