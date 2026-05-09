import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('id, host_id, status')
    .eq('room_code', code.toUpperCase())
    .single()

  if (tableError || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  if (table.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can abandon the game' }, { status: 403 })
  }

  if (table.status !== 'playing') {
    return NextResponse.json({ error: 'No active game to abandon' }, { status: 409 })
  }

  // Find the active game for this table
  const { data: game } = await admin
    .from('games')
    .select('id')
    .eq('table_id', table.id)
    .neq('phase', 'showdown')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (game) {
    // Mark game as showdown (ended) with no winner
    await admin
      .from('games')
      .update({ phase: 'showdown', pot: 0, current_player_id: null })
      .eq('id', game.id)
  }

  // Return each player's current stack from table_seats back to their chip_balance
  const { data: seats } = await admin
    .from('table_seats')
    .select('user_id, stack')
    .eq('table_id', table.id)

  if (seats && seats.length > 0) {
    for (const seat of seats) {
      const { data: profile } = await admin
        .from('profiles')
        .select('chip_balance')
        .eq('id', seat.user_id)
        .single()

      if (profile) {
        await admin
          .from('profiles')
          .update({ chip_balance: profile.chip_balance + seat.stack })
          .eq('id', seat.user_id)
      }
    }

    // Remove all seats so players can rejoin fresh
    await admin.from('table_seats').delete().eq('table_id', table.id)
  }

  // Reset table to waiting
  await admin.from('tables').update({ status: 'waiting' }).eq('id', table.id)

  return NextResponse.json({ success: true })
}
