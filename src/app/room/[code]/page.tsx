'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameState } from '@/hooks/useGameState'
import { PokerTable } from '@/components/game/PokerTable'
import { ActionPanel } from '@/components/game/ActionPanel'
import { GameResultModal } from '@/components/game/GameResultModal'
import { Chat } from '@/components/game/Chat'
import { WalletBadge } from '@/components/game/WalletBadge'
import type { ActionType, WinnerResult } from '@/types'
import Link from 'next/link'

function BuyInModal({
  minBuyin,
  maxBuyin,
  tableCode,
  onClose,
  onJoined,
}: {
  minBuyin: number
  maxBuyin: number
  tableCode: string
  onClose: () => void
  onJoined: () => void
}) {
  const [amount, setAmount] = useState(minBuyin)
  const [seatNumber, setSeatNumber] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/tables/${tableCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyin_amount: amount, seat_number: seatNumber }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to join table')
      onJoined()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(6, 22, 11, 0.98)',
          borderColor: 'rgba(212,175,55,0.25)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(212,175,55,0.1)' }}>
          <h2 className="text-xl font-black text-white">Buy In</h2>
          <p className="text-xs mt-0.5" style={{ color: '#4a6050' }}>
            Choose your starting stack
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Buy-in amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#d4af37' }}>
              Buy-In Amount
            </label>
            <input
              type="number"
              min={minBuyin}
              max={maxBuyin}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full px-4 py-3 rounded-xl text-white text-lg font-bold focus:outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
            <p className="text-xs mt-1.5" style={{ color: '#4a6050' }}>
              Range: {minBuyin.toLocaleString()} – {maxBuyin.toLocaleString()} chips
            </p>
            <input
              type="range"
              min={minBuyin}
              max={maxBuyin}
              step={minBuyin}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-2"
              style={{ accentColor: '#d4af37' }}
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: '#3a4f3e' }}>
              <span>{minBuyin.toLocaleString()}</span>
              <span>{maxBuyin.toLocaleString()}</span>
            </div>
          </div>

          {/* Seat selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#d4af37' }}>
              Seat Number
            </label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((seat) => (
                <button
                  key={seat}
                  type="button"
                  onClick={() => setSeatNumber(seat)}
                  className="py-2 rounded-lg text-sm font-bold transition-all"
                  style={
                    seatNumber === seat
                      ? {
                          background: 'linear-gradient(135deg, #d4af37, #b8960c)',
                          color: '#030d07',
                        }
                      : {
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#6b7280',
                        }
                  }
                >
                  {seat}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all"
              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#6b7c6e' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #b8960c)',
                color: '#030d07',
                boxShadow: '0 4px 15px rgba(212,175,55,0.25)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Joining…
                </span>
              ) : (
                `Buy In — ${amount.toLocaleString()} chips`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string).toUpperCase()
  const [showBuyIn, setShowBuyIn] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [abandoning, setAbandoning] = useState(false)
  const [handWinners, setHandWinners] = useState<WinnerResult[] | null>(null)
  const [handLosers, setHandLosers] = useState<Array<{ userId: string; amount: number }> | null>(null)
  const firstLoadDone = useRef(false)

  const supabase = createClient()
  const { gameState, table, seats, myProfile, loading, error, sendAction, startGame, fetchResult, refetch } =
    useGameState(code)

  // Wrap sendAction to match ActionPanel's expected signature
  const handleAction = async (action: ActionType, amount?: number) => {
    const result = await sendAction(action, amount)
    if (result && result.winners.length > 0) {
      setHandWinners(result.winners)
      setHandLosers(result.losers)
    }
  }

  const handleAbandon = async () => {
    if (!confirm('Abandon game? Each player\'s current chips will be returned to their wallet.')) return
    setAbandoning(true)
    try {
      const res = await fetch(`/api/tables/${code}/abandon`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'Failed to abandon game')
      } else {
        await refetch()
      }
    } finally {
      setAbandoning(false)
    }
  }

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
      } else {
        setAuthenticated(true)
      }
    })
  }, [router, supabase.auth])

  // Detect showdown transition — fetch and display winners for the player who didn't trigger the hand end
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    const phase = gameState?.game?.phase ?? null
    if (phase === 'showdown' && prevPhaseRef.current !== 'showdown' && !handWinners) {
      const gameId = gameState?.game?.id
      if (gameId) {
        fetchResult(gameId).then((result) => {
          if (result && result.winners.length > 0) {
            setHandWinners(result.winners)
            setHandLosers(result.losers)
          }
        })
      }
    }
    prevPhaseRef.current = phase
  }, [gameState?.game?.phase, gameState?.game?.id, fetchResult, handWinners])

  // Determine if user is seated (use seats directly — available even with no active game)
  const isSeated =
    myProfile && seats.some((s) => s.user_id === myProfile.id)

  // Show buy-in modal only on first load if not already seated
  useEffect(() => {
    if (!loading && !firstLoadDone.current) {
      firstLoadDone.current = true
      if (table && myProfile && !isSeated && !error) {
        setShowBuyIn(true)
      }
    }
  }, [loading, table, myProfile, isSeated, error])

  if (authenticated === null || loading) {
    return (
      <div
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center"
        style={{ background: '#030d07' }}
      >
        <div className="text-center">
          <div
            className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#d4af37', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#4a6050' }}>
            Connecting to table {code}…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-white"
        style={{ background: '#030d07' }}
      >
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-30">🃏</div>
          <p className="text-xl font-bold text-red-400 mb-2">Table Not Found</p>
          <p className="text-sm mb-6" style={{ color: '#4a6050' }}>
            Room <span className="font-mono" style={{ color: '#d4af37' }}>{code}</span> doesn&apos;t exist
          </p>
          <Link
            href="/lobby"
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #d4af37, #b8960c)',
              color: '#030d07',
            }}
          >
            Back to Lobby
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)] text-white flex flex-col"
      style={{ background: '#030d07' }}
    >
      {/* Room header bar */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          background: 'rgba(4,16,8,0.9)',
          borderColor: 'rgba(212,175,55,0.12)',
        }}
      >
        <div className="flex items-center gap-4">
          <Link href="/lobby" className="text-sm transition-colors" style={{ color: '#4a6050' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#4a6050')}
          >
            ← Lobby
          </Link>
          <div
            className="h-4 border-l"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          />
          <span className="font-mono font-black text-lg" style={{ color: '#d4af37' }}>
            {code}
          </span>
          {table && (
            <span className="text-xs" style={{ color: '#4a6050' }}>
              {table.small_blind}/{table.big_blind} blinds · {table.max_players} seats
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {myProfile && <WalletBadge balance={myProfile.chip_balance} />}
          {myProfile && (
            <span className="text-sm hidden sm:block" style={{ color: '#6b7280' }}>
              {myProfile.display_name}
            </span>
          )}
          {table && myProfile && table.host_id === myProfile.id && table.status === 'playing' && (
            <button
              onClick={handleAbandon}
              disabled={abandoning}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#f87171',
              }}
            >
              {abandoning ? 'Ending…' : 'Abandon Game'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main table area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <PokerTable
            gameState={gameState}
            seats={seats}
            myUserId={myProfile?.id}
            hostId={table?.host_id}
            onStartGame={startGame}
            tableCode={code}
          />

          {gameState && myProfile && (
            <ActionPanel
              gameState={gameState}
              myUserId={myProfile.id}
              onAction={handleAction}
              isBB={(() => {
                if (!gameState.game) return false;
                const sorted = [...seats].sort((a, b) => a.seat_number - b.seat_number);
                const pivot = sorted.findIndex((s) => s.seat_number > gameState.game.dealer_seat);
                const ordered = pivot === -1 ? sorted : [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
                const bbSeat = ordered[1]?.seat_number ?? ordered[0]?.seat_number;
                const mySeat = seats.find((s) => s.user_id === myProfile.id);
                return mySeat?.seat_number === bbSeat;
              })()}
            />
          )}

          {!isSeated && !showBuyIn && table && (
            <button
              onClick={() => setShowBuyIn(true)}
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #b8960c)',
                color: '#030d07',
                boxShadow: '0 4px 15px rgba(212,175,55,0.25)',
              }}
            >
              Take a Seat
            </button>
          )}
          {isSeated && !showBuyIn && table && table.status !== 'playing' && (() => {
            const mySeatStack = seats.find((s) => s.user_id === myProfile?.id)?.stack ?? 1
            return mySeatStack === 0 ? (
              <button
                onClick={() => setShowBuyIn(true)}
                className="px-6 py-3 rounded-xl font-bold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(22,163,74,0.3)',
                  border: '1px solid rgba(74,222,128,0.3)',
                }}
              >
                Rebuy
              </button>
            ) : null
          })()}
        </div>

        {/* Chat sidebar */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-l"
          style={{
            background: 'rgba(4,16,8,0.8)',
            borderColor: 'rgba(212,175,55,0.08)',
          }}
        >
          <Chat
            roomCode={code}
            userId={myProfile?.id}
            displayName={myProfile?.display_name}
          />
        </div>
      </div>

      {/* Buy-in modal */}
      {showBuyIn && table && (
        <BuyInModal
          minBuyin={table.min_buyin}
          maxBuyin={table.max_buyin}
          tableCode={code}
          onClose={() => setShowBuyIn(false)}
          onJoined={() => {
            setShowBuyIn(false)
            refetch()
          }}
        />
      )}

      {/* Hand result modal — shown after a hand completes */}
      {handWinners && handWinners.length > 0 && (
        <GameResultModal
          winners={handWinners}
          losers={handLosers ?? []}
          seats={(seats as Array<{ user_id: string; profile: { display_name: string } }>)}
          isHost={!!(table && myProfile && table.host_id === myProfile.id)}
          onPlayAgain={async () => {
            setHandWinners(null)
            setHandLosers(null)
            try {
              await startGame()
            } catch {
              // ignore — PokerTable already shows error inline
            }
          }}
          onDismiss={() => {
            setHandWinners(null)
            setHandLosers(null)
          }}
        />
      )}
    </div>
  )
}
