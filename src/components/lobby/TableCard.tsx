import Link from 'next/link'
import type { Table } from '@/types'

interface Props {
  table: Table
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; badgeBg: string; badgeColor: string }> = {
  waiting: {
    dot: '#22c55e',
    label: 'Waiting',
    badgeBg: 'rgba(34,197,94,0.12)',
    badgeColor: '#86efac',
  },
  in_progress: {
    dot: '#f59e0b',
    label: 'In Progress',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeColor: '#fcd34d',
  },
  finished: {
    dot: '#6b7280',
    label: 'Finished',
    badgeBg: 'rgba(107,114,128,0.12)',
    badgeColor: '#9ca3af',
  },
}

export function TableCard({ table }: Props) {
  const statusCfg = STATUS_CONFIG[table.status] ?? STATUS_CONFIG.finished
  const isJoinable = table.status === 'waiting'

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 border transition-all group"
      style={{
        background: 'rgba(8, 28, 14, 0.8)',
        borderColor: 'rgba(212,175,55,0.12)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.3)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(12, 38, 18, 0.9)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.12)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(8, 28, 14, 0.8)'
      }}
    >
      {/* Room code + status */}
      <div className="flex items-start justify-between">
        <div>
          <span
            className="font-mono font-black text-2xl tracking-widest"
            style={{ color: '#d4af37' }}
          >
            {table.room_code}
          </span>
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-2 ml-0 block w-fit"
            style={{
              background: statusCfg.badgeBg,
              color: statusCfg.badgeColor,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: statusCfg.dot }}
            />
            {statusCfg.label}
          </div>
        </div>

        {/* Blinds */}
        <div className="text-right">
          <p className="font-bold text-white text-lg">
            {table.small_blind}/{table.big_blind}
          </p>
          <p className="text-xs" style={{ color: '#4a6050' }}>blinds</p>
        </div>
      </div>

      {/* Buy-in range + max players */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-xl px-3 py-2 col-span-1"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-xs mb-0.5" style={{ color: '#4a6050' }}>Min</p>
          <p className="text-white font-semibold text-sm">{table.min_buyin.toLocaleString()}</p>
        </div>
        <div
          className="rounded-xl px-3 py-2 col-span-1"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-xs mb-0.5" style={{ color: '#4a6050' }}>Max</p>
          <p className="text-white font-semibold text-sm">{table.max_buyin.toLocaleString()}</p>
        </div>
        <div
          className="rounded-xl px-3 py-2 col-span-1"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-xs mb-0.5" style={{ color: '#4a6050' }}>Seats</p>
          <p className="text-white font-semibold text-sm">{table.max_players}</p>
        </div>
      </div>

      {/* Join button */}
      <Link
        href={`/room/${table.room_code}`}
        className="block text-center py-2.5 rounded-xl font-bold text-sm transition-all"
        style={
          isJoinable
            ? {
                background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                color: '#030d07',
                boxShadow: '0 4px 12px rgba(212,175,55,0.2)',
              }
            : {
                background: 'rgba(255,255,255,0.05)',
                color: '#6b7280',
                border: '1px solid rgba(255,255,255,0.06)',
              }
        }
      >
        {isJoinable ? 'Join Table' : (table.status as string) === 'in_progress' ? 'Spectate' : 'View'}
      </Link>
    </div>
  )
}
