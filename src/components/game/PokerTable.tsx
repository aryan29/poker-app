'use client';

import { useState } from 'react';
import type { GameState, TableSeat, Profile } from '@/types';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';

interface Props {
  gameState: GameState | null;
  seats: TableSeat[];
  myUserId: string | undefined;
  hostId?: string;
  onStartGame: () => void | Promise<void>;
  tableCode: string;
}

// Oval seat positions (percentage of container), 9 seats
const SEAT_POSITIONS = [
  { top: '88%', left: '50%' },   // Seat 1 — bottom center (me)
  { top: '78%', left: '18%' },   // Seat 2 — bottom left
  { top: '50%', left: '3%' },    // Seat 3 — left middle
  { top: '20%', left: '15%' },   // Seat 4 — top left
  { top: '8%',  left: '38%' },   // Seat 5 — top left-center
  { top: '8%',  left: '62%' },   // Seat 6 — top right-center
  { top: '20%', left: '85%' },   // Seat 7 — top right
  { top: '50%', left: '97%' },   // Seat 8 — right middle
  { top: '78%', left: '82%' },   // Seat 9 — bottom right
];

export function PokerTable({ gameState, seats, myUserId, hostId, onStartGame, tableCode }: Props) {
  const [startError, setStartError] = useState<string | null>(null);
  const game = gameState?.game;
  const isHost = myUserId && hostId && myUserId === hostId;

  const handleStartGame = async () => {
    setStartError(null);
    try {
      await onStartGame();
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Failed to start game');
    }
  };

  // Compute SB and BB seat numbers from dealer seat
  const sbSeat = (() => {
    if (!game) return null;
    const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number);
    const pivot = sorted.findIndex((s) => s.seat_number > game.dealer_seat);
    const ordered = pivot === -1 ? sorted : [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
    return ordered[0]?.seat_number ?? null;
  })();

  const bbSeat = (() => {
    if (!game) return null;
    const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number);
    const pivot = sorted.findIndex((s) => s.seat_number > game.dealer_seat);
    const ordered = pivot === -1 ? sorted : [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
    return ordered[1]?.seat_number ?? ordered[0]?.seat_number ?? null;
  })();

  return (
    <div className="w-full max-w-4xl px-12 py-10">
      {/* Outer wood rail */}
      <div
        className="relative w-full rounded-[50%] overflow-visible"
        style={{
          aspectRatio: '2 / 1.1',
          background: 'linear-gradient(135deg, #6b3a1f 0%, #92400e 40%, #78350f 70%, #6b3a1f 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 2px rgba(0,0,0,0.5)',
          padding: '14px',
        }}
      >
        {/* Inner felt surface */}
        <div
          className="absolute rounded-[50%] overflow-hidden"
          style={{
            inset: '14px',
            background: 'radial-gradient(ellipse at 50% 40%, #1e6b42 0%, #155a35 35%, #0d4226 70%, #062917 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4)',
          }}
        >
          {/* Felt noise texture */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: '150px 150px',
            }}
          />

          {/* Subtle felt stripe pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent 0px,
                transparent 4px,
                rgba(255,255,255,1) 4px,
                rgba(255,255,255,1) 5px
              )`,
            }}
          />

          {/* Table logo/watermark */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ opacity: 0.04 }}
          >
            <div
              className="w-32 h-32 rounded-full"
              style={{
                border: '2px solid white',
              }}
            />
          </div>
        </div>

        {/* Community cards + pot — centered on the table */}
        <div
          className="absolute flex flex-col items-center justify-center gap-2"
          style={{
            inset: '14px',
            pointerEvents: 'none',
          }}
        >
          {game && (
            <div className="flex flex-col items-center gap-2" style={{ pointerEvents: 'auto' }}>
              <CommunityCards
                cards={game.community_cards}
                phase={game.phase}
                pot={game.pot}
              />
              <span
                className="text-emerald-300/50 text-xs uppercase tracking-[0.25em] mt-1"
              >
                {game.phase}
              </span>
            </div>
          )}

          {!game && (
            <div className="text-center" style={{ pointerEvents: 'auto' }}>
              <p className="text-emerald-200/30 text-xs uppercase tracking-widest font-semibold">
                {tableCode}
              </p>
            </div>
          )}
        </div>

        {/* Player seats */}
        {SEAT_POSITIONS.map((pos, idx) => {
          const seatNumber = idx + 1;
          const seat = seats.find((s) => s.seat_number === seatNumber) as
            | (TableSeat & { profile: Profile })
            | undefined;
          const isCurrentPlayer = game?.current_player_id === seat?.user_id;
          const isDealer = game?.dealer_seat === seatNumber;
          const isMe = seat?.user_id === myUserId;

          // For other players, find their hand status from seats (we don't have all hands client-side)
          // We show folded status only for my hand; others show as playing
          const myHand = isMe ? gameState?.myHand ?? null : null;

          return (
            <div
              key={seatNumber}
              className="absolute"
              style={{
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -50%)',
                zIndex: isMe ? 10 : 5,
              }}
            >
              <PlayerSeat
                seat={seat}
                seatNumber={seatNumber}
                isCurrentPlayer={isCurrentPlayer}
                isDealer={isDealer}
                isMe={isMe}
                myHand={myHand}
                isSB={game?.phase !== 'waiting' && sbSeat === seatNumber}
                isBB={game?.phase !== 'waiting' && bbSeat === seatNumber}
              />
            </div>
          );
        })}
      </div>

      {/* Waiting state / game over — show Start Game for host */}
      {(!game || game.phase === 'showdown') && seats.length >= 2 && isHost && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <button
            onClick={handleStartGame}
            className="px-6 py-2.5 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #15803d, #166534)',
              border: '1px solid rgba(52,211,153,0.3)',
              boxShadow: '0 4px 16px rgba(21,128,61,0.3)',
            }}
          >
            {game?.phase === 'showdown' ? 'Start New Hand' : 'Start Game'}
          </button>
          {startError && (
            <p className="text-red-400 text-xs">{startError}</p>
          )}
        </div>
      )}
      {(!game || game.phase === 'showdown') && seats.length >= 2 && !isHost && (
        <p className="text-center mt-4 text-xs" style={{ color: '#4a6050' }}>
          Waiting for the host to start{game?.phase === 'showdown' ? ' a new hand' : ''}…
        </p>
      )}
      {(!game || game.phase === 'showdown') && seats.length < 2 && (
        <p className="text-center mt-4 text-xs" style={{ color: '#4a6050' }}>
          Waiting for players… ({seats.length}/2 minimum)
        </p>
      )}
    </div>
  );
}
