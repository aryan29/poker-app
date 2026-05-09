'use client';

import { useState } from 'react';
import type { PokerTable, TableSeat, Profile } from '@/types';

interface Props {
  table: PokerTable;
  seats: (TableSeat & { profile: Profile })[];
  myUserId: string;
  onStartGame: () => Promise<void>;
}

export function WaitingRoom({ table, seats, myUserId, onStartGame }: Props) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const isHost = table.host_id === myUserId;
  const canStart = isHost && seats.length >= 2;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(table.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      await onStartGame();
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Failed to start game');
    } finally {
      setStarting(false);
    }
  };

  // All seat slots
  const allSeats = Array.from({ length: table.max_players }, (_, i) => {
    const n = i + 1;
    return seats.find((s) => s.seat_number === n) ?? null;
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      {/* Room code card */}
      <div
        className="flex flex-col items-center gap-3 px-10 py-8 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, rgba(6,78,59,0.6), rgba(4,47,36,0.6))',
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <p className="text-emerald-400/70 text-xs uppercase tracking-[0.3em] font-semibold">
          Room Code
        </p>
        <div
          className="font-black text-5xl tracking-[0.3em] font-mono"
          style={{
            color: '#fff',
            textShadow: '0 0 20px rgba(52,211,153,0.4), 0 2px 4px rgba(0,0,0,0.6)',
            letterSpacing: '0.4em',
          }}
        >
          {table.room_code}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: copied
              ? 'linear-gradient(135deg, #065f46, #047857)'
              : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: copied ? '#34d399' : '#9ca3af',
          }}
        >
          {copied ? (
            <>
              <span>✓</span> Copied!
            </>
          ) : (
            <>
              <span>⎘</span> Copy Code
            </>
          )}
        </button>
        <p className="text-gray-500 text-xs">Share this code with your friends</p>
      </div>

      {/* Players list */}
      <div className="w-full max-w-sm">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-3 text-center">
          Players ({seats.length}/{table.max_players})
        </p>
        <div className="flex flex-col gap-2">
          {allSeats.map((seat, i) => {
            const seatNum = i + 1;
            return (
              <div
                key={seatNum}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: seat
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.2)',
                  border: seat
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px dashed rgba(255,255,255,0.07)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: seat
                      ? 'linear-gradient(135deg, #065f46, #047857)'
                      : 'rgba(0,0,0,0.3)',
                    color: seat ? '#34d399' : '#374151',
                    border: seat ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {seat ? seat.profile.display_name.charAt(0).toUpperCase() : seatNum}
                </div>
                <div className="flex-1 min-w-0">
                  {seat ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100 truncate">
                        {seat.profile.display_name}
                        {seat.user_id === myUserId && (
                          <span className="text-emerald-400 text-xs ml-1">(you)</span>
                        )}
                        {seat.user_id === table.host_id && (
                          <span className="text-yellow-400 text-xs ml-1">HOST</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">Empty seat</span>
                  )}
                </div>
                {seat && (
                  <span className="text-xs text-gray-500 font-mono">
                    {seat.stack.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Table info */}
      <div className="flex gap-4 text-center">
        <div>
          <p className="text-gray-500 text-xs">Blinds</p>
          <p className="text-gray-200 text-sm font-semibold">
            {table.small_blind}/{table.big_blind}
          </p>
        </div>
        <div
          className="w-px h-8 self-center"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        />
        <div>
          <p className="text-gray-500 text-xs">Buy-in</p>
          <p className="text-gray-200 text-sm font-semibold">
            {table.min_buyin.toLocaleString()}–{table.max_buyin.toLocaleString()}
          </p>
        </div>
        <div
          className="w-px h-8 self-center"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        />
        <div>
          <p className="text-gray-500 text-xs">Players</p>
          <p className="text-gray-200 text-sm font-semibold">
            {seats.length}/{table.max_players}
          </p>
        </div>
      </div>

      {/* Start / waiting message */}
      {startError && (
        <p className="text-red-400 text-sm text-center">{startError}</p>
      )}

      {isHost ? (
        <button
          onClick={handleStart}
          disabled={!canStart || starting}
          className="px-10 py-3.5 rounded-2xl text-base font-bold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canStart
              ? 'linear-gradient(135deg, #15803d, #166534)'
              : 'rgba(0,0,0,0.4)',
            border: canStart
              ? '1px solid rgba(52,211,153,0.4)'
              : '1px solid rgba(255,255,255,0.08)',
            boxShadow: canStart ? '0 4px 20px rgba(21,128,61,0.4)' : 'none',
          }}
        >
          {starting
            ? 'Starting…'
            : canStart
            ? 'Start Game'
            : `Need ${2 - seats.length} more player${2 - seats.length !== 1 ? 's' : ''}`}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#fbbf24' }}
          />
          <p className="text-gray-400 text-sm">Waiting for the host to start the game…</p>
        </div>
      )}
    </div>
  );
}
