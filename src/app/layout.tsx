import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Nav } from '@/components/layout/Nav'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PokerNight — Play Poker With Friends',
  description: 'Real-time Texas Hold\'em poker with friends. Private rooms, chip wallets, and a premium table experience.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-gray-950 text-white min-h-screen">
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        <div className="pt-16">
          {children}
        </div>
      </body>
    </html>
  )
}
