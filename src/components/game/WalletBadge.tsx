'use client';

import { useState } from 'react';

interface Props {
  balance: number;
  onBalanceUpdate?: (newBalance: number) => void;
}

export function WalletBadge({ balance, onBalanceUpdate }: Props) {
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBalance, setLocalBalance] = useState(balance);

  // Sync when prop changes
  if (balance !== localBalance && !loading) {
    setLocalBalance(balance);
  }

  const handleTopUp = async () => {
    const amount = parseInt(topUpAmount, 10);
    if (isNaN(amount) || amount <= 0 || amount > 100000) {
      setError('Enter 1–100,000 chips');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Top-up failed');
      setLocalBalance(data.chip_balance);
      onBalanceUpdate?.(data.chip_balance);
      setShowTopUp(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Badge */}
      <button
        onClick={() => setShowTopUp((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,30,0.9), rgba(10,10,10,0.9))',
          border: '1px solid rgba(251,191,36,0.4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <ChipIcon />
        <span className="text-yellow-400 text-sm font-bold font-mono">
          {localBalance.toLocaleString()}
        </span>
        <span className="text-gray-500 text-xs">chips</span>
      </button>

      {/* Top-up popover */}
      {showTopUp && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowTopUp(false);
              setError(null);
            }}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 p-4 rounded-2xl w-56"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a, #111)',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            }}
          >
            <p className="text-gray-300 text-sm font-semibold mb-3">Top Up Chips</p>

            <div className="flex flex-col gap-2 mb-3">
              {[500, 1000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(String(amt))}
                  className="w-full py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background:
                      topUpAmount === String(amt)
                        ? 'rgba(251,191,36,0.15)'
                        : 'rgba(255,255,255,0.04)',
                    border:
                      topUpAmount === String(amt)
                        ? '1px solid rgba(251,191,36,0.4)'
                        : '1px solid rgba(255,255,255,0.06)',
                    color: topUpAmount === String(amt) ? '#fde68a' : '#9ca3af',
                  }}
                >
                  +{amt.toLocaleString()} chips
                </button>
              ))}
            </div>

            <div className="mb-3">
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => {
                  setTopUpAmount(e.target.value);
                  setError(null);
                }}
                placeholder="Custom amount"
                className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none py-1.5 px-3 rounded-lg"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs mb-2 text-center">{error}</p>
            )}

            <button
              onClick={handleTopUp}
              disabled={loading}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #d97706, #92400e)',
                border: '1px solid rgba(251,191,36,0.3)',
                boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
              }}
            >
              {loading ? 'Adding…' : 'Add Chips'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ChipIcon() {
  return (
    <div className="relative w-5 h-5 flex-shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(#ef4444 0deg 90deg, #fbbf24 90deg 180deg, #3b82f6 180deg 270deg, #22c55e 270deg 360deg)',
        }}
      />
      <div className="absolute inset-0.5 rounded-full bg-gray-900/80" />
      <div
        className="absolute inset-1 rounded-full"
        style={{ border: '1px dashed rgba(255,255,255,0.3)' }}
      />
    </div>
  );
}
