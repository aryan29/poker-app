import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateTableRequest } from '@/types'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function GET() {
  const supabase = await createClient()

  const { data: tables, error } = await supabase
    .from('tables')
    .select('*, table_seats(count)')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tables })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTableRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { small_blind, big_blind, min_buyin, max_buyin, max_players } = body

  if (!small_blind || !big_blind || small_blind <= 0 || big_blind <= small_blind) {
    return NextResponse.json({ error: 'Invalid blind structure' }, { status: 400 })
  }

  if (!min_buyin || !max_buyin || min_buyin < big_blind * 10 || max_buyin < min_buyin) {
    return NextResponse.json({ error: 'Invalid buy-in range' }, { status: 400 })
  }

  if (!max_players || max_players < 2 || max_players > 9) {
    return NextResponse.json({ error: 'Max players must be between 2 and 9' }, { status: 400 })
  }

  // Generate unique room code
  let room_code = generateRoomCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('tables')
      .select('id')
      .eq('room_code', room_code)
      .maybeSingle()

    if (!existing) break
    room_code = generateRoomCode()
    attempts++
  }

  const { data: table, error } = await supabase
    .from('tables')
    .insert({
      room_code,
      host_id: user.id,
      small_blind,
      big_blind,
      min_buyin,
      max_buyin,
      max_players,
      status: 'waiting',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ table }, { status: 201 })
}
