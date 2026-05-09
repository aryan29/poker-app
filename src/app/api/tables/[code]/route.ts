import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()

  const { data: table, error } = await supabase
    .from('tables')
    .select(
      `
      *,
      table_seats (
        *,
        profile:profiles (*)
      )
    `
    )
    .eq('room_code', code.toUpperCase())
    .single()

  if (error || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  return NextResponse.json({ table })
}
