'use client';

import type { GameState, ActionType } from '@/types';
import { useState } from 'react';

interface Props {
  gameState: GameState;
  myUserId: string;
  onAction: (action: ActionType, amount?: number) => Promise<void>;
  isBB?: boolean;
}

export function ActionPanel({ gameState, myUserId, onAction, isBB }: Props) {
  const [raiseAmount, setRaiseAmount] = useState<string>('');
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { game, myHand, isMyTurn, currentPlayer } = gameState;
  const bigBlind = gameState.table?.big_blind ?? 20;

  // Find my seat to get my stack
  const mySeat = gameState.seats.find((s) => s.user_id === myUserId);
  const myStack = mySeat?.stack ?? 0;

  // Use current_bet from game record — it's the authoritative max bet this round
  const maxCurrentBet = game.current_bet ?? 0;

  const myCurrentBet = myHand?.current_bet ?? 0;
  const callAmount = Math.min(Math.max(0, maxCurrentBet - myCurrentBet), myStack);
  const canCheck = callAmount === 0;

  // Minimum raise = previous raise increment on top of max current bet
  const minRaise = Math.max(maxCurrentBet + bigBlind, callAmount + 1);
  const maxRaise = myStack;

  const handleAction = async (action: ActionType, amount?: number) => {
    if (pending) return;
    setPending(action);
    setActionError(null);
    try {
      await onAction(action, amount);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      setActionError(msg);
    } finally {
      setPending(null);
    }
  };

  const handleRaise = () => {
    const amt = parseInt(raiseAmount, 10);
    if (isNaN(amt) || amt < minRaise) {
      setActionError(`Minimum raise is ${minRaise}`);
      return;
    }
    if (amt > maxRaise) {
      setActionError(`Maximum raise is ${maxRaise}`);
      return;
    }
    handleAction('raise', amt);
  };

  const isPending = pending !== null;

  if (!isMyTurn) {
    const waitingFor = currentPlayer?.profile?.display_name ?? 'someone';
    return (
      <div
        className="flex items-center justify-center px-8 py-4 rounded-2xl"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#fbbf24' }}
          />
          <span className="text-gray-400 text-sm">
            Waiting for{' '}
            <span className="text-yellow-400 font-semibold">{waitingFor}</span>
            {' '}to act…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 px-6 py-4 rounded-2xl w-full max-w-lg"
      style={{
        background: 'rgba(0,0,0,0.65)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Your turn banner */}
      <div className="flex items-center justify-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#34d399' }}
        />
        <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
          {isBB && canCheck && game.phase === 'preflop' ? 'BB Option — Check or Raise' : 'Your Turn'}
        </span>
      </div>

      {/* Error */}
      {actionError && (
        <div className="text-red-400 text-xs text-center bg-red-950/40 rounded-lg px-3 py-1.5">
          {actionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 items-center">
        {/* Fold */}
        <ActionButton
          label="Fold"
          onClick={() => handleAction('fold')}
          disabled={isPending}
          isLoading={pending === 'fold'}
          color="red"
          className="flex-1"
        />

        {/* Check or Call */}
        {canCheck ? (
          <ActionButton
            label="Check"
            onClick={() => handleAction('check')}
            disabled={isPending}
            isLoading={pending === 'check'}
            color="gray"
            className="flex-1"
          />
        ) : (
          <ActionButton
            label={`Call ${callAmount.toLocaleString()}`}
            onClick={() => handleAction('call')}
            disabled={isPending}
            isLoading={pending === 'call'}
            color="blue"
            className="flex-1"
          />
        )}

        {/* All-in */}
        {myStack > 0 && (
          <ActionButton
            label="All In"
            onClick={() => handleAction('all_in', myStack)}
            disabled={isPending}
            isLoading={pending === 'all_in'}
            color="purple"
            className="flex-1"
          />
        )}
      </div>

      {/* Raise row */}
      {myStack > minRaise && (
        <div className="flex gap-2 items-center">
          <div
            className="flex-1 flex items-center rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            <span className="text-gray-500 text-xs px-3">Raise</span>
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={(e) => {
                setRaiseAmount(e.target.value);
                setActionError(null);
              }}
              placeholder={`${minRaise}–${maxRaise}`}
              className="flex-1 bg-transparent text-white text-sm py-2 pr-3 outline-none placeholder-gray-600"
            />
          </div>
          <ActionButton
            label="Raise"
            onClick={handleRaise}
            disabled={isPending || !raiseAmount}
            isLoading={pending === 'raise'}
            color="green"
          />
        </div>
      )}

      {/* Quick raise amounts */}
      {myStack > minRaise && (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {[0.5, 0.75, 1].map((fraction) => {
            const amt = Math.min(Math.floor(game.pot * fraction), myStack);
            if (amt < minRaise) return null;
            return (
              <button
                key={fraction}
                onClick={() => setRaiseAmount(String(amt))}
                disabled={isPending}
                className="px-2.5 py-1 text-xs rounded-full text-gray-300 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {fraction === 0.5 ? '1/2 pot' : fraction === 0.75 ? '3/4 pot' : 'Pot'} ({amt.toLocaleString()})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  color: 'red' | 'gray' | 'blue' | 'green' | 'purple';
  className?: string;
}

const COLOR_STYLES: Record<string, { base: string; hover: string; border: string }> = {
  red: {
    base: 'linear-gradient(135deg, #dc2626, #991b1b)',
    hover: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'rgba(239,68,68,0.4)',
  },
  gray: {
    base: 'linear-gradient(135deg, #374151, #1f2937)',
    hover: 'linear-gradient(135deg, #4b5563, #374151)',
    border: 'rgba(107,114,128,0.4)',
  },
  blue: {
    base: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
    hover: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: 'rgba(59,130,246,0.4)',
  },
  green: {
    base: 'linear-gradient(135deg, #15803d, #166534)',
    hover: 'linear-gradient(135deg, #16a34a, #15803d)',
    border: 'rgba(34,197,94,0.4)',
  },
  purple: {
    base: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    hover: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    border: 'rgba(139,92,246,0.4)',
  },
};

function ActionButton({ label, onClick, disabled, isLoading, color, className = '' }: ActionButtonProps) {
  const s = COLOR_STYLES[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        background: s.base,
        border: `1px solid ${s.border}`,
        boxShadow: `0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = s.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = s.base;
      }}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-1.5">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {label}
        </span>
      ) : label}
    </button>
  );
}
