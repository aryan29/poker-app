'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/lobby')
    })
  }, [router, supabase.auth])

  return (
    <main
      className="min-h-[calc(100vh-4rem)] text-white flex flex-col relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center top, #0d2818 0%, #071a0f 35%, #030d07 70%)',
      }}
    >
      {/* Felt texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255,255,255,0.1) 4px,
            rgba(255,255,255,0.1) 8px
          )`,
        }}
      />

      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(22,101,52,0.25) 0%, transparent 70%)',
        }}
      />

      {/* Floating suits */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {[
          { suit: '♠', top: '5%', left: '3%', size: '8rem', opacity: 0.04, rotate: -20 },
          { suit: '♥', top: '10%', right: '5%', size: '9rem', opacity: 0.04, rotate: 15 },
          { suit: '♦', bottom: '15%', left: '5%', size: '6rem', opacity: 0.04, rotate: 10 },
          { suit: '♣', bottom: '8%', right: '4%', size: '10rem', opacity: 0.03, rotate: -30 },
          { suit: '♠', top: '55%', left: '1%', size: '4rem', opacity: 0.04, rotate: 8 },
          { suit: '♥', top: '45%', right: '2%', size: '5rem', opacity: 0.04, rotate: -12 },
        ].map((item, i) => (
          <span
            key={i}
            className="absolute"
            style={{
              top: item.top,
              left: (item as { left?: string }).left,
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

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 text-center py-20 relative z-10">
        {/* Decorative card fan */}
        <div className="flex items-end justify-center gap-1 mb-12 relative h-28 pointer-events-none">
          {[
            { label: 'A', suit: '♠', red: false, rotate: -25, tx: -20, ty: 12 },
            { label: 'K', suit: '♥', red: true, rotate: -12, tx: -8, ty: 4 },
            { label: 'Q', suit: '♦', red: true, rotate: 0, tx: 0, ty: 0 },
            { label: 'J', suit: '♣', red: false, rotate: 12, tx: 8, ty: 4 },
            { label: '10', suit: '♠', red: false, rotate: 25, tx: 20, ty: 12 },
          ].map((card, i) => (
            <div
              key={i}
              className="absolute w-14 h-20 bg-white rounded-lg shadow-2xl flex flex-col items-start justify-start p-1.5"
              style={{
                transform: `rotate(${card.rotate}deg) translate(${card.tx}px, ${card.ty}px)`,
                zIndex: 5 - Math.abs(i - 2),
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              <span
                className="text-sm font-black leading-none"
                style={{ color: card.red ? '#ef4444' : '#111' }}
              >
                {card.label}
              </span>
              <span className="text-sm leading-none" style={{ color: card.red ? '#ef4444' : '#111' }}>
                {card.suit}
              </span>
            </div>
          ))}
        </div>

        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-black mb-5 leading-tight tracking-tight">
            Play Poker{' '}
            <span style={{ color: '#d4af37', textShadow: '0 0 40px rgba(212,175,55,0.3)' }}>
              With Friends
            </span>
          </h1>
          <p className="text-xl md:text-2xl mb-4 font-medium" style={{ color: '#a0b5a5' }}>
            No casino. No middleman. Just you and your friends.
          </p>
          <p className="text-base mb-10 max-w-2xl mx-auto" style={{ color: '#4a6050' }}>
            Real-time Texas Hold&apos;em in private rooms. Custom blinds, chip wallets, and a
            premium table experience — right in your browser.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/lobby"
              className="group px-8 py-4 text-lg font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                color: '#030d07',
                boxShadow: '0 8px 30px rgba(212,175,55,0.3)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(212,175,55,0.45)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(212,175,55,0.3)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              🃏 Create a Table
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-200 border"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#e5e7eb',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        className="py-16 px-8 border-t relative z-10"
        style={{ borderColor: 'rgba(212,175,55,0.1)' }}
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest mb-10" style={{ color: '#4a6050' }}>
            Why PokerNight
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '⚡',
                title: 'Real-Time Play',
                desc: 'Sub-second updates powered by Supabase Realtime. Every action is instant — no lag, no refresh.',
              },
              {
                icon: '🔒',
                title: 'Private Rooms',
                desc: 'Share a 6-character room code. Custom blinds and buy-in ranges — your game, your rules.',
              },
              {
                icon: '🪙',
                title: 'Chip Wallet',
                desc: 'Your chips carry between sessions. Track your progress across every game you play.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 border transition-all"
                style={{
                  background: 'rgba(8, 30, 15, 0.6)',
                  borderColor: 'rgba(212,175,55,0.1)',
                }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7c6e' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Card suits footer decoration */}
      <footer
        className="text-center py-6 text-xs border-t relative z-10"
        style={{ color: '#2d3f30', borderColor: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center justify-center gap-3 mb-2 text-base opacity-30">
          {['♠', '♥', '♦', '♣'].map((s, i) => (
            <span key={s} style={{ color: i % 2 ? '#ef4444' : '#fff' }}>
              {s}
            </span>
          ))}
        </div>
        PokerNight — Built with Next.js + Supabase
      </footer>
    </main>
  )
}
