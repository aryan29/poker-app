'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Table } from '@/types'

interface Props {
  onClose: () => void
  onCreated: (table: Table) => void
}

export function CreateTableModal({ onClose, onCreated }: Props) {
  const [smallBlind, setSmallBlind] = useState(10)
  const [bigBlind, setBigBlind] = useState(20)
  const [minBuyin, setMinBuyin] = useState(200)
  const [maxBuyin, setMaxBuyin] = useState(1000)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          small_blind: smallBlind,
          big_blind: bigBlind,
          min_buyin: minBuyin,
          max_buyin: maxBuyin,
          max_players: maxPlayers,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create table')
      onCreated(json.table)
      router.push(`/room/${json.table.room_code}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
        style={{
          background: 'rgba(6, 22, 11, 0.98)',
          borderColor: 'rgba(212,175,55,0.2)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'rgba(212,175,55,0.1)' }}
        >
          <div>
            <h2 className="text-xl font-black text-white">Create Table</h2>
            <p className="text-xs mt-0.5" style={{ color: '#4a6050' }}>
              Set up your private poker room
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all"
            style={{ color: '#4a6050' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLElement).style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#4a6050'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Blinds */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#d4af37' }}>
              Blinds
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6b7c6e' }}>Small Blind</label>
                <input
                  type="number"
                  min={1}
                  value={smallBlind}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSmallBlind(v)
                    if (bigBlind < v * 2) setBigBlind(v * 2)
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6b7c6e' }}>Big Blind</label>
                <input
                  type="number"
                  min={smallBlind * 2}
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>
          </div>

          {/* Buy-in range */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#d4af37' }}>
              Buy-In Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6b7c6e' }}>Minimum</label>
                <input
                  type="number"
                  min={bigBlind * 2}
                  value={minBuyin}
                  onChange={(e) => setMinBuyin(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#6b7c6e' }}>Maximum</label>
                <input
                  type="number"
                  min={minBuyin}
                  value={maxBuyin}
                  onChange={(e) => setMaxBuyin(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#d4af37' }}>
              Max Players
              <span className="ml-2 font-black text-white text-sm">{maxPlayers}</span>
            </label>
            <input
              type="range"
              min={2}
              max={9}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#d4af37' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: '#3a4f3e' }}>
              <span>2 players</span>
              <span>9 players</span>
            </div>
          </div>

          {/* Summary */}
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}
          >
            <p style={{ color: '#8a9e8e' }}>
              <span style={{ color: '#d4af37' }}>Blinds:</span> {smallBlind}/{bigBlind} ·{' '}
              <span style={{ color: '#d4af37' }}>Buy-in:</span> {minBuyin.toLocaleString()}–{maxBuyin.toLocaleString()} ·{' '}
              <span style={{ color: '#d4af37' }}>Seats:</span> {maxPlayers}
            </p>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border"
              style={{
                background: 'transparent',
                borderColor: 'rgba(255,255,255,0.08)',
                color: '#6b7c6e',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#6b7c6e'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                color: '#030d07',
                boxShadow: '0 4px 15px rgba(212,175,55,0.25)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating…
                </span>
              ) : (
                'Create Table'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
