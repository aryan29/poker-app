import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: table } = await supabase
    .from('tables').select('id').eq('room_code', code.toUpperCase()).single()
  if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

  const { data: history, error } = await supabase
    .from('hand_history')
    .select('*')
    .eq('table_id', table.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: history ?? [] })
}
