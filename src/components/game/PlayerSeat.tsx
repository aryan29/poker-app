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
  isSB?: boolean;
  isBB?: boolean;
}

// Pastel avatar colors by seat number
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

function ChipStack({ amount }: { amount: number }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(251,191,36,0.5)',
        color: '#fbbf24',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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
  isSB,
  isBB,
}: Props) {
  // Empty seat
  if (!seat) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            border: '2px dashed rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <span className="text-gray-600 text-xs font-mono">{seatNumber}</span>
        </div>
      </div>
    );
  }

  const folded = isFolded ?? myHand?.is_folded;
  const avatarColor = AVATAR_COLORS[(seatNumber - 1) % AVATAR_COLORS.length];
  const hasBet = myHand && myHand.current_bet > 0;

  return (
    <div
      className={`relative flex flex-col items-center gap-0.5 transition-all duration-300 ${
        folded ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {/* Dealer button */}
      {isDealer && (
        <div
          className="absolute -top-4 -right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f9fafb, #e5e7eb)',
            border: '2px solid #9ca3af',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-gray-800 text-xs font-black">D</span>
        </div>
      )}

      {/* SB badge */}
      {isSB && !isDealer && (
        <div
          className="absolute -top-4 -left-2 z-20 px-1.5 py-0.5 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-white text-xs font-black">SB</span>
        </div>
      )}
      {isSB && isDealer && (
        <div
          className="absolute -top-4 -left-2 z-20 px-1.5 py-0.5 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-white text-xs font-black">SB</span>
        </div>
      )}

      {/* BB badge */}
      {isBB && (
        <div
          className="absolute -top-8 -right-2 z-20 px-1.5 py-0.5 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #b45309)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-white text-xs font-black">BB</span>
        </div>
      )}

      {/* Hole cards (above avatar) */}
      {myHand && !folded && (
        <div className="flex gap-0.5 mb-0.5">
          {isMe && myHand.hole_cards.length > 0 ? (
            myHand.hole_cards.map((code) => (
              <Card key={code} card={code} size="sm" />
            ))
          ) : (
            <>
              <Card faceDown size="sm" />
              <Card faceDown size="sm" />
            </>
          )}
        </div>
      )}

      {/* Turn glow ring */}
      {isCurrentPlayer && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{
            background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
          }}
        />
      )}

      {/* Avatar */}
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)`,
          border: isCurrentPlayer
            ? '3px solid #fbbf24'
            : isMe
            ? '3px solid #34d399'
            : '2px solid rgba(255,255,255,0.2)',
          boxShadow: isCurrentPlayer
            ? '0 0 16px rgba(251,191,36,0.7), 0 4px 12px rgba(0,0,0,0.5)'
            : isMe
            ? '0 0 12px rgba(52,211,153,0.4), 0 4px 10px rgba(0,0,0,0.5)'
            : '0 4px 10px rgba(0,0,0,0.5)',
        }}
      >
        <span className="drop-shadow-sm">{getInitials(seat.profile.display_name)}</span>

        {/* All-in badge */}
        {seat.status === 'all_in' && (
          <div
            className="absolute -bottom-1 -right-1 px-1 rounded text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              fontSize: '9px',
              color: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            ALL IN
          </div>
        )}
      </div>

      {/* Player info card */}
      <div
        className="flex flex-col items-center px-2 py-0.5 rounded-lg"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span
          className={`text-xs font-semibold truncate max-w-[68px] ${
            isMe ? 'text-emerald-300' : 'text-gray-100'
          }`}
        >
          {seat.profile.display_name}
        </span>
        <ChipStack amount={seat.stack} />
      </div>

      {/* Current bet chips */}
      {hasBet && (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            background: 'linear-gradient(135deg, #d97706, #92400e)',
            color: '#fef3c7',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            fontSize: '10px',
          }}
        >
          Bet: {myHand.current_bet.toLocaleString()}
        </div>
      )}

      {/* Turn indicator */}
      {isCurrentPlayer && (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold animate-bounce"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#1c1917',
            fontSize: '9px',
            boxShadow: '0 2px 6px rgba(251,191,36,0.5)',
          }}
        >
          ACTING
        </div>
      )}

      {/* Folded badge */}
      {folded && (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#6b7280',
            fontSize: '9px',
          }}
        >
          FOLDED
        </div>
      )}
    </div>
  );
}
