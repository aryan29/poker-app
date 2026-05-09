'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

const SUITS = ['♠', '♥', '♦', '♣']

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Redirect already-logged-in users straight to lobby
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/lobby')
    })
  }, [router, supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName: displayName || email.split('@')[0] }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to create account')
        // The signup API signs in server-side, but the browser still needs its own
        // session cookie — sign in here too so the lobby auth check passes.
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/lobby')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/lobby')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #0d2818 0%, #071a0f 40%, #030d07 100%)',
      }}
    >
      {/* Felt texture */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255,255,255,0.03) 4px,
            rgba(255,255,255,0.03) 8px
          )`,
        }}
      />

      {/* Floating card suits decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { suit: '♠', top: '8%', left: '5%', size: '5rem', opacity: 0.07, rotate: -15 },
          { suit: '♥', top: '15%', right: '8%', size: '6rem', opacity: 0.06, rotate: 20 },
          { suit: '♦', bottom: '12%', left: '10%', size: '4rem', opacity: 0.06, rotate: 10 },
          { suit: '♣', bottom: '20%', right: '5%', size: '7rem', opacity: 0.05, rotate: -25 },
          { suit: '♠', top: '50%', left: '2%', size: '3rem', opacity: 0.05, rotate: 5 },
          { suit: '♥', top: '40%', right: '3%', size: '4rem', opacity: 0.05, rotate: -10 },
        ].map((item, i) => (
          <span
            key={i}
            className="absolute select-none"
            style={{
              top: item.top,
              left: item.left,
              right: (item as { right?: string }).right,
              bottom: (item as { bottom?: string }).bottom,
              fontSize: item.size,
              opacity: item.opacity,
              transform: `rotate(${item.rotate}deg)`,
              color: item.suit === '♥' || item.suit === '♦' ? '#ef4444' : '#ffffff',
            }}
          >
            {item.suit}
          </span>
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            {SUITS.map((suit, i) => (
              <span
                key={suit}
                className="text-2xl font-bold"
                style={{ color: i % 2 === 0 ? '#ffffff' : '#ef4444' }}
              >
                {suit}
              </span>
            ))}
          </div>
          <h1
            className="text-4xl font-black mb-1"
            style={{ color: '#d4af37', textShadow: '0 0 20px rgba(212,175,55,0.4)' }}
          >
            PokerNight
          </h1>
          <p className="text-sm" style={{ color: '#6b7c6e' }}>
            Texas Hold&apos;em with friends
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl border"
          style={{
            background: 'rgba(8, 30, 15, 0.95)',
            borderColor: 'rgba(212,175,55,0.2)',
            boxShadow:
              '0 25px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.1), inset 0 1px 0 rgba(212,175,55,0.1)',
          }}
        >
          {/* Mode tabs */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200"
                style={
                  mode === m
                    ? {
                        background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                        color: '#030d07',
                        boxShadow: '0 2px 8px rgba(212,175,55,0.3)',
                      }
                    : { color: '#6b7c6e' }
                }
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#d4af37' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Poker Pro"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 transition-all focus:outline-none"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#d4af37' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 transition-all focus:outline-none"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#d4af37' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 transition-all focus:outline-none"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? 'rgba(212,175,55,0.5)'
                  : 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                color: '#030d07',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(212,175,55,0.3)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-center mt-4 text-xs" style={{ color: '#4a5c4e' }}>
              You&apos;ll start with 1,000 chips. No real money involved.
            </p>
          )}
        </div>

        {/* Decorative card row */}
        <div className="flex items-center justify-center gap-2 mt-8 opacity-30">
          {[
            { label: 'A', suit: '♠', red: false },
            { label: 'K', suit: '♥', red: true },
            { label: 'Q', suit: '♦', red: true },
            { label: 'J', suit: '♣', red: false },
            { label: '10', suit: '♠', red: false },
          ].map((card, i) => (
            <div
              key={i}
              className="w-10 h-14 bg-white rounded-md flex flex-col items-start justify-start p-1 shadow-lg"
              style={{ transform: `rotate(${(i - 2) * 5}deg)` }}
            >
              <span className="text-xs font-black leading-none" style={{ color: card.red ? '#ef4444' : '#111' }}>
                {card.label}
              </span>
              <span className="text-xs leading-none" style={{ color: card.red ? '#ef4444' : '#111' }}>
                {card.suit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
