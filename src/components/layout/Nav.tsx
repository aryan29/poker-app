'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function Nav() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Routes where nav should be hidden or minimal (login page handles its own branding)
  const isAuthPage = pathname === '/login'

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setProfile(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(data)
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    loadProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => subscription.unsubscribe()
  }, [loadProfile, supabase.auth])

  // Subscribe to real-time chip balance updates
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`nav-profile:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          setProfile((prev) => (prev ? { ...prev, ...(payload.new as Partial<Profile>) } : prev))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setMenuOpen(false)
    router.replace('/')
  }

  if (!mounted) return null

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16 border-b"
      style={{
        background: 'rgba(4, 16, 8, 0.95)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(212,175,55,0.15)',
      }}
    >
      {/* Logo */}
      <Link
        href={profile ? '/lobby' : '/'}
        className="flex items-center gap-2 group"
      >
        <span className="text-xl" aria-hidden>🃏</span>
        <span
          className="font-black text-xl tracking-tight"
          style={{ color: '#d4af37' }}
        >
          PokerNight
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {isAuthPage && !profile ? null : !profile ? (
          <>
            <Link
              href="/login"
              className="text-sm font-medium transition-colors"
              style={{ color: '#6b7c6e' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7c6e')}
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #b8960c)',
                color: '#030d07',
              }}
            >
              Play Now
            </Link>
          </>
        ) : (
          <>
            {/* Chip balance */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.25)',
                color: '#d4af37',
              }}
            >
              <span>🪙</span>
              <span>{(profile.chip_balance ?? 0).toLocaleString()}</span>
            </div>

            {/* Lobby link */}
            <Link
              href="/lobby"
              className="text-sm font-medium transition-colors hidden sm:block"
              style={{ color: pathname === '/lobby' ? '#d4af37' : '#6b7c6e' }}
            >
              Lobby
            </Link>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: '#e5e7eb',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #166534, #052e16)', color: '#4ade80' }}
                >
                  {(profile.display_name ?? 'P')[0].toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">
                  {profile.display_name}
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  {/* Menu */}
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl z-20 overflow-hidden py-1"
                    style={{
                      background: 'rgba(6, 20, 10, 0.98)',
                      border: '1px solid rgba(212,175,55,0.2)',
                    }}
                  >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <p className="text-sm font-semibold text-white truncate">{profile.display_name}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#4a5c4e' }}>
                        {(profile.chip_balance ?? 0).toLocaleString()} chips
                      </p>
                    </div>
                    <Link
                      href="/lobby"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors w-full text-left"
                      style={{ color: '#9ca3af' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                        e.currentTarget.style.color = '#fff'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#9ca3af'
                      }}
                    >
                      <span>🎮</span> Lobby
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors w-full text-left"
                      style={{ color: '#9ca3af' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                        e.currentTarget.style.color = '#fca5a5'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#9ca3af'
                      }}
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
