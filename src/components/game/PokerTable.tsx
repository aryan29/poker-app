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
  showdownCards?: Record<string, string[]>;
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

export function PokerTable({ gameState, seats, myUserId, hostId, onStartGame, tableCode, showdownCards }: Props) {
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
  // Heads-up rule: dealer IS the small blind; the other player is BB
  const sbSeat = (() => {
    if (!game) return null;
    const isHU = seats.length === 2;
    if (isHU) return game.dealer_seat;
    const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number);
    const pivot = sorted.findIndex((s) => s.seat_number > game.dealer_seat);
    const ordered = pivot === -1 ? sorted : [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
    return ordered[0]?.seat_number ?? null;
  })();

  const bbSeat = (() => {
    if (!game) return null;
    const isHU = seats.length === 2;
    if (isHU) {
      // BB is the non-dealer player
      return seats.find((s) => s.seat_number !== game.dealer_seat)?.seat_number ?? null;
    }
    const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number);
    const pivot = sorted.findIndex((s) => s.seat_number > game.dealer_seat);
    const ordered = pivot === -1 ? sorted : [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
    return ordered[1]?.seat_number ?? ordered[0]?.seat_number ?? null;
  })();

  return (
    <div className="w-full max-w-4xl px-2 sm:px-8 lg:px-12 py-4 sm:py-8 lg:py-10">
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

          {/* Radial spotlight — center glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 55% 40% at 50% 48%, rgba(255,255,255,0.04) 0%, transparent 70%)',
            }}
          />

          {/* Dealer emblem — center of table */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ paddingBottom: '6%' }}
          >
            <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
              {/* Outer glow ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
              {/* Four suits arranged in a ring */}
              <svg viewBox="0 0 90 90" width="90" height="90" style={{ opacity: 0.18 }}>
                {/* ♠ top */}
                <text x="45" y="22" textAnchor="middle" fontSize="18" fill="white">♠</text>
                {/* ♥ right */}
                <text x="72" y="52" textAnchor="middle" fontSize="18" fill="#f87171">♥</text>
                {/* ♣ bottom */}
                <text x="45" y="80" textAnchor="middle" fontSize="18" fill="white">♣</text>
                {/* ♦ left */}
                <text x="18" y="52" textAnchor="middle" fontSize="18" fill="#f87171">♦</text>
                {/* Center dividing ring */}
                <circle cx="45" cy="45" r="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
                {/* DEALER text */}
                <text x="45" y="49" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="monospace" letterSpacing="1.5" fontWeight="bold">DEALER</text>
              </svg>
            </div>
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
                roundPot={game.round_pot}
                sidePots={game.side_pots}
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
          const myHand = isMe ? gameState?.myHand ?? null : null;

          // Derive folded status for all players from game actions
          const isFolded = seat
            ? (gameState?.actions ?? []).some(
                (a) => a.user_id === seat.user_id && a.action === 'fold'
              )
            : false;

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
                isFolded={isFolded}
                revealedCards={seat && showdownCards ? showdownCards[seat.user_id] : undefined}
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
