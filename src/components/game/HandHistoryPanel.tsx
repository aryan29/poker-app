'use client'

import { useEffect, useState } from 'react'

interface HandHistoryEntry {
  id: string
  table_id: string
  game_id: string
  winner_user_ids: string[]
  pot: number
  community_cards: string[]
  player_results: Record<
    string,
    { holeCards: string[]; netChips: number; handRank: string | null }
  >
  created_at: string
}

interface HandHistoryPanelProps {
  tableCode: string
  myUserId: string
  onClose: () => void
}

function suitSymbol(suit: string): string {
  switch (suit) {
    case 'h': return '♥'
    case 'd': return '♦'
    case 'c': return '♣'
    case 's': return '♠'
    default: return suit
  }
}

function suitColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? '#ef4444' : '#e5e7eb'
}

function formatCard(code: string): { rank: string; suit: string; symbol: string; color: string } {
  const rank = code.slice(0, -1)
  const suit = code.slice(-1)
  return { rank, suit, symbol: suitSymbol(suit), color: suitColor(suit) }
}

function CardChip({ code }: { code: string }) {
  const { rank, suit, symbol, color } = formatCard(code)
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: 'rgba(255,255,255,0.08)', color }}
      title={`${rank}${suit}`}
    >
      {rank}<span>{symbol}</span>
    </span>
  )
}

export function HandHistoryPanel({ tableCode, myUserId, onClose }: HandHistoryPanelProps) {
  const [history, setHistory] = useState<HandHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/tables/${tableCode}/history`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.history ?? [])
      })
      .catch(() => {
        setHistory([])
      })
      .finally(() => setLoading(false))
  }, [tableCode])

  // Compute stats
  const myHands = history.filter((h) => h.player_results[myUserId] !== undefined)
  const myWins = myHands.filter((h) => h.winner_user_ids.includes(myUserId)).length
  const winPct = myHands.length > 0 ? Math.round((myWins / myHands.length) * 100) : 0
  const netChipsTotal = myHands.reduce(
    (sum, h) => sum + (h.player_results[myUserId]?.netChips ?? 0),
    0
  )

  return (
    <div
      className="fixed z-40 flex flex-col"
      style={{
        top: '64px',
        right: 0,
        bottom: 0,
        width: 'min(320px, 100vw)',
        background: 'rgba(3, 13, 7, 0.97)',
        borderLeft: '1px solid rgba(212,175,55,0.18)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(212,175,55,0.12)', background: 'rgba(4,16,8,0.95)' }}
      >
        <div>
          <span className="font-bold text-white text-sm">Hand History</span>
          <span className="ml-2 text-xs" style={{ color: '#4a6050' }}>
            last 10 hands
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}
        >
          ✕ Close
        </button>
      </div>

      {/* Hand list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#d4af37', borderTopColor: 'transparent' }}
            />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl opacity-20">🃏</span>
            <p className="text-sm" style={{ color: '#4a6050' }}>
              No hands yet
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {history.map((hand, idx) => {
              const myResult = hand.player_results[myUserId]
              const isWinner = hand.winner_user_ids.includes(myUserId)
              const net = myResult?.netChips ?? null
              const holeCards = myResult?.holeCards ?? []
              const handRank = myResult?.handRank ?? null

              return (
                <div
                  key={hand.id}
                  className="px-4 py-3 flex flex-col gap-2"
                  style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                >
                  {/* Row top: hand number, W/L badge, chip delta, time */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: '#4a6050' }}>
                      Hand #{history.length - idx}
                    </span>

                    {myResult !== undefined && (
                      <span
                        className="text-xs font-black px-1.5 py-0.5 rounded"
                        style={{
                          background: isWinner ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.18)',
                          color: isWinner ? '#4ade80' : '#f87171',
                        }}
                      >
                        {isWinner ? 'W' : 'L'}
                      </span>
                    )}

                    {net !== null && (
                      <span
                        className="text-xs font-bold"
                        style={{ color: net >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {net >= 0 ? '+' : ''}{net.toLocaleString()}
                      </span>
                    )}

                    <span className="text-xs ml-auto" style={{ color: '#3a4f3e' }}>
                      {new Date(hand.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* My hole cards */}
                  {holeCards.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs mr-1" style={{ color: '#4a6050' }}>
                        Hole:
                      </span>
                      {holeCards.map((code) => (
                        <CardChip key={code} code={code} />
                      ))}
                      {handRank && (
                        <span
                          className="ml-1 text-xs italic"
                          style={{ color: '#d4af37' }}
                        >
                          {handRank}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Community cards */}
                  {hand.community_cards.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs mr-1" style={{ color: '#4a6050' }}>
                        Board:
                      </span>
                      {hand.community_cards.map((code) => (
                        <CardChip key={code} code={code} />
                      ))}
                    </div>
                  )}

                  {/* Pot */}
                  <div className="text-xs" style={{ color: '#3a4f3e' }}>
                    Pot: <span style={{ color: '#6b7280' }}>{hand.pot.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {!loading && myHands.length > 0 && (
        <div
          className="border-t px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'rgba(212,175,55,0.12)', background: 'rgba(4,16,8,0.95)' }}
        >
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: '#d4af37' }}>
              {winPct}%
            </div>
            <div className="text-xs" style={{ color: '#4a6050' }}>Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black text-white">{myHands.length}</div>
            <div className="text-xs" style={{ color: '#4a6050' }}>Hands</div>
          </div>
          <div className="text-center">
            <div
              className="text-sm font-black"
              style={{ color: netChipsTotal >= 0 ? '#4ade80' : '#f87171' }}
            >
              {netChipsTotal >= 0 ? '+' : ''}{netChipsTotal.toLocaleString()}
            </div>
            <div className="text-xs" style={{ color: '#4a6050' }}>Net Chips</div>
          </div>
        </div>
      )}
    </div>
  )
}
