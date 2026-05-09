import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { JoinTableRequest } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: JoinTableRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Support both `stack` (new) and `buyin_amount` (legacy) field names
  const rawBody = body as JoinTableRequest & { buyin_amount?: number }
  const buyin_amount = rawBody.stack ?? rawBody.buyin_amount ?? 0
  const seat_number = rawBody.seat_number

  // Fetch table info
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('room_code', code.toUpperCase())
    .single()

  if (tableError || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  if (buyin_amount < table.min_buyin || buyin_amount > table.max_buyin) {
    return NextResponse.json(
      { error: `Buy-in must be between ${table.min_buyin} and ${table.max_buyin}` },
      { status: 400 }
    )
  }

  // Check if player already at table
  const { data: existingSeat } = await supabase
    .from('table_seats')
    .select('id, stack')
    .eq('table_id', table.id)
    .eq('user_id', user.id)
    .maybeSingle()

  // Allow rebuy only when already seated with 0 chips; block fresh joins mid-game
  const isRebuy = !!existingSeat && existingSeat.stack === 0
  if (existingSeat && !isRebuy) {
    return NextResponse.json({ error: 'Already seated at this table' }, { status: 409 })
  }
  if (!existingSeat && table.status === 'playing') {
    return NextResponse.json({ error: 'Game already in progress — wait for the next hand' }, { status: 409 })
  }
  if (!existingSeat && (seat_number === undefined || seat_number < 1 || seat_number > table.max_players)) {
    return NextResponse.json(
      { error: `Seat number must be between 1 and ${table.max_players}` },
      { status: 400 }
    )
  }

  // Check player balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('chip_balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.chip_balance < buyin_amount) {
    return NextResponse.json({ error: 'Insufficient chip balance' }, { status: 400 })
  }

  // Rebuy: top up existing seat stack
  if (isRebuy) {
    const [updateResult] = await Promise.all([
      supabase
        .from('table_seats')
        .update({ stack: buyin_amount, status: 'active' })
        .eq('table_id', table.id)
        .eq('user_id', user.id)
        .select()
        .single(),
      supabase
        .from('profiles')
        .update({ chip_balance: profile.chip_balance - buyin_amount })
        .eq('id', user.id),
    ])
    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
    }
    return NextResponse.json({ seat: updateResult.data }, { status: 200 })
  }

  // Fresh join: insert new seat
  const [seatResult] = await Promise.all([
    supabase
      .from('table_seats')
      .insert({
        table_id: table.id,
        user_id: user.id,
        seat_number,
        stack: buyin_amount,
        status: 'active',
      })
      .select()
      .single(),
    supabase
      .from('profiles')
      .update({ chip_balance: profile.chip_balance - buyin_amount })
      .eq('id', user.id),
  ])

  if (seatResult.error) {
    if (seatResult.error.code === '23505') {
      return NextResponse.json({ error: 'Seat already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: seatResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ seat: seatResult.data }, { status: 201 })
}
