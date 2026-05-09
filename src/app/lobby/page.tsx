'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreateTableModal } from '@/components/lobby/CreateTableModal'
import { TableCard } from '@/components/lobby/TableCard'
import type { Table, Profile } from '@/types'

export default function LobbyPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const loadTables = useCallback(async () => {
    const res = await fetch('/api/tables')
    const json = await res.json()
    setTables(json.tables ?? [])
  }, [])

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)
      await loadTables()
      setLoading(false)
    }

    init()
  }, [router, supabase, loadTables])

  // Real-time chip balance
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`lobby-profile:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          setProfile((prev) => (prev ? { ...prev, ...(payload.new as Partial<Profile>) } : prev))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, supabase])

  const handleTableCreated = (table: Table) => {
    setShowCreate(false)
    router.push(`/room/${table.room_code}`)
  }

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code || code.length < 4) {
      setJoinError('Enter a valid room code')
      return
    }
    setJoinError('')
    router.push(`/room/${code}`)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #0d2818 0%, #071a0f 40%, #030d07 100%)' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#d4af37', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#4a6050' }}>Loading lobby…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)] text-white"
      style={{ background: 'radial-gradient(ellipse at center top, #0d2818 0%, #071a0f 40%, #030d07 100%)' }}
    >
      {/* Felt texture */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)`,
        }}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">Your Tables</h1>
            {profile && (
              <p className="text-sm mt-1" style={{ color: '#4a6050' }}>
                Welcome back, <span style={{ color: '#d4af37' }}>{profile.display_name}</span>
                {' '}· {(profile.chip_balance ?? 0).toLocaleString()} chips
              </p>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all self-start sm:self-auto"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
              color: '#030d07',
              boxShadow: '0 4px 15px rgba(212,175,55,0.3)',
            }}
          >
            <span className="text-lg">+</span> Create Table
          </button>
        </div>

        {/* Join by code */}
        <div
          className="rounded-2xl p-5 mb-8 border"
          style={{
            background: 'rgba(8,30,15,0.7)',
            borderColor: 'rgba(212,175,55,0.15)',
          }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: '#d4af37' }}>
            Have a room code?
          </p>
          <form onSubmit={handleJoinByCode} className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              placeholder="Enter room code…"
              maxLength={8}
              className="flex-1 px-4 py-2.5 rounded-xl font-mono text-white placeholder-gray-600 text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: `1px solid ${joinError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
              onBlur={(e) => (e.target.style.borderColor = joinError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)')}
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border"
              style={{
                background: 'rgba(212,175,55,0.12)',
                borderColor: 'rgba(212,175,55,0.3)',
                color: '#d4af37',
              }}
            >
              Join
            </button>
          </form>
          {joinError && (
            <p className="text-xs mt-2" style={{ color: '#fca5a5' }}>{joinError}</p>
          )}
        </div>

        {/* Tables grid */}
        {tables.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-5 opacity-30">🃏</div>
            <p className="text-xl font-semibold text-white mb-2">No tables open</p>
            <p className="text-sm mb-6" style={{ color: '#4a6050' }}>
              Create a table and invite friends to play
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #b8960c)',
                color: '#030d07',
              }}
            >
              Create Your First Table
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium" style={{ color: '#4a6050' }}>
                {tables.length} table{tables.length !== 1 ? 's' : ''} available
              </p>
              <button
                onClick={loadTables}
                className="text-xs transition-colors"
                style={{ color: '#4a6050' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#4a6050')}
              >
                ↻ Refresh
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <TableCard key={table.id} table={table} />
              ))}
            </div>
          </>
        )}
      </main>

      {showCreate && (
        <CreateTableModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTableCreated}
        />
      )}
    </div>
  )
}
