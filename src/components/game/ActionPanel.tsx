'use client';

import type { GameState, ActionType } from '@/types';
import { useState } from 'react';
import { evaluateHand } from '@/lib/poker/evaluator';
import type { HandRank } from '@/types';

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

  // ── Hand Strength Badge ────────────────────────────────────────────────────
  const showHandStrength =
    isMyTurn &&
    (game.phase === 'flop' || game.phase === 'turn' || game.phase === 'river') &&
    myHand?.hole_cards?.length === 2 &&
    (game.community_cards?.length ?? 0) >= 3;

  let handResult: ReturnType<typeof evaluateHand> | null = null;
  if (showHandStrength) {
    try {
      handResult = evaluateHand([...myHand!.hole_cards, ...game.community_cards]);
    } catch {
      handResult = null;
    }
  }

  // ── Pot Odds ───────────────────────────────────────────────────────────────
  const showPotOdds = isMyTurn && callAmount > 0;
  const requiredEquity = showPotOdds
    ? Math.round((callAmount / (game.pot + callAmount)) * 100)
    : 0;

  if (!isMyTurn) {
    const waitingFor = currentPlayer?.profile?.display_name ?? 'someone';
    return (
      <div
        className="flex items-center justify-center px-8 py-3 rounded-2xl"
        style={{
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
          position: 'relative',
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 16 }}>⏳</span>
          <span className="text-gray-400 text-sm">
            Waiting for{' '}
            <span className="text-yellow-400 font-semibold">{waitingFor}</span>
            {' '}to act…
          </span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: '#fbbf24', animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 rounded-2xl w-full max-w-lg"
      style={{
        background: 'rgba(4,20,10,0.85)',
        border: '1px solid rgba(52,211,153,0.2)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.05)',
        isolation: 'isolate',
        position: 'relative',
        zIndex: 20,
      }}
    >
      {/* YOUR TURN header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.25)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#34d399' }}
          />
          <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">
            {isBB && canCheck && game.phase === 'preflop' ? '♛ BB Option' : '♠ Your Turn'}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
          {handResult && (
            <HandStrengthBadge rank={handResult.rank} description={handResult.description} />
          )}
          {myCurrentBet > 0 && (
            <span style={{ color: '#f59e0b' }}>
              Bet: <span className="font-bold">{myCurrentBet.toLocaleString()}</span>
            </span>
          )}
          <span style={{ color: '#4a6050' }}>
            Stack: <span className="font-semibold text-gray-300">{myStack.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Pot Odds Bar */}
      {showPotOdds && (
        <div
          data-testid="pot-odds-bar"
          className="rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.18)',
            color: '#fbbf24',
          }}
        >
          <span style={{ opacity: 0.6 }}>🎯</span>
          Call <span className="font-bold">{callAmount.toLocaleString()}</span> into pot of <span className="font-bold">{game.pot.toLocaleString()}</span>
          <span className="ml-auto font-bold text-yellow-300">{requiredEquity}% equity needed</span>
        </div>
      )}

      {/* Error */}
      {actionError && (
        <div className="text-red-400 text-xs text-center bg-red-950/40 rounded-lg px-3 py-1.5">
          {actionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 sm:gap-2 items-center">
        {/* Fold */}
        <ActionButton
          label="✕ Fold"
          onClick={() => handleAction('fold')}
          disabled={isPending}
          isLoading={pending === 'fold'}
          color="red"
          className="flex-1 min-h-[40px] sm:min-h-[46px]"
        />

        {/* Check or Call */}
        {canCheck ? (
          <ActionButton
            label="✓ Check"
            onClick={() => handleAction('check')}
            disabled={isPending}
            isLoading={pending === 'check'}
            color="gray"
            className="flex-1 min-h-[40px] sm:min-h-[46px]"
          />
        ) : (
          <ActionButton
            label={`📞 Call ${callAmount.toLocaleString()}`}
            onClick={() => handleAction('call')}
            disabled={isPending}
            isLoading={pending === 'call'}
            color="blue"
            className="flex-1 min-h-[40px] sm:min-h-[46px]"
          />
        )}

        {/* All-in */}
        {myStack > 0 && (
          <ActionButton
            label="⚡ All In"
            onClick={() => handleAction('all_in', myStack)}
            disabled={isPending}
            isLoading={pending === 'all_in'}
            color="purple"
            className="flex-1 min-h-[40px] sm:min-h-[46px]"
          />
        )}
      </div>

      {/* Raise row */}
      {myStack > minRaise && (
        <div className="flex gap-1.5 sm:gap-2 items-center">
          <div
            className="flex-1 flex items-center rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(52,211,153,0.2)',
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <span className="text-emerald-600 text-xs px-3 flex-shrink-0 font-semibold">↑ Raise</span>
            <input
              type="number"
              inputMode="numeric"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={(e) => {
                setRaiseAmount(e.target.value);
                setActionError(null);
              }}
              placeholder={`${minRaise}–${maxRaise}`}
              className="flex-1 bg-transparent text-white text-sm py-2.5 pr-3 outline-none placeholder-gray-700 min-w-0"
            />
          </div>
          <ActionButton
            label="Raise ↑"
            onClick={handleRaise}
            disabled={isPending || !raiseAmount}
            isLoading={pending === 'raise'}
            color="green"
            className="min-h-[40px] sm:min-h-[46px]"
          />
        </div>
      )}

      {/* Quick raise presets */}
      {myStack > minRaise && (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {([0.33, 0.5, 0.75, 1] as const).map((fraction) => {
            const amt = Math.min(Math.floor(game.pot * fraction), myStack);
            if (amt < minRaise) return null;
            const label =
              fraction === 0.33 ? '⅓ pot' :
              fraction === 0.5  ? '½ pot' :
              fraction === 0.75 ? '¾ pot' : 'Pot';
            return (
              <button
                key={fraction}
                onClick={() => setRaiseAmount(String(amt))}
                disabled={isPending}
                className="px-2.5 py-1.5 text-xs rounded-lg text-gray-300 hover:text-white transition-all active:scale-95 min-h-[36px]"
                style={{
                  background: raiseAmount === String(amt) ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)',
                  border: raiseAmount === String(amt) ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color: raiseAmount === String(amt) ? '#34d399' : undefined,
                }}
              >
                {label} <span className="opacity-60">({amt.toLocaleString()})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hand Strength Badge ─────────────────────────────────────────────────────

const HAND_BADGE_STYLES: Record<HandRank, { bg: string; color: string; border: string }> = {
  'high-card':       { bg: 'rgba(107,114,128,0.3)', color: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  'pair':            { bg: 'rgba(59,130,246,0.2)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  'two-pair':        { bg: 'rgba(99,102,241,0.2)',  color: '#818cf8', border: 'rgba(99,102,241,0.2)' },
  'three-of-a-kind': { bg: 'rgba(52,211,153,0.2)',  color: '#34d399', border: 'rgba(52,211,153,0.2)' },
  'straight':        { bg: 'rgba(20,184,166,0.2)',  color: '#2dd4bf', border: 'rgba(20,184,166,0.2)' },
  'flush':           { bg: 'rgba(168,85,247,0.2)',  color: '#c084fc', border: 'rgba(168,85,247,0.2)' },
  'full-house':      { bg: 'rgba(249,115,22,0.2)',  color: '#fb923c', border: 'rgba(249,115,22,0.2)' },
  'four-of-a-kind':  { bg: 'rgba(239,68,68,0.2)',   color: '#f87171', border: 'rgba(239,68,68,0.2)' },
  'straight-flush':  { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
  'royal-flush':     { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
};

function HandStrengthBadge({ rank, description }: { rank: HandRank; description: string }) {
  const s = HAND_BADGE_STYLES[rank] ?? HAND_BADGE_STYLES['high-card'];
  return (
    <span
      data-testid="hand-strength-badge"
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {description}
    </span>
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
      className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${className}`}
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
