import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PlayerResult = {
  holeCards?: string[]
  netChips?: number
  handRank?: string | null
  revealed?: boolean
}

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

  // Use admin client — hand_history has no public RLS read policy.
  // We filter per-requestor below to hide other players' folded hole cards.
  const admin = createAdminClient()
  const { data: history, error } = await admin
    .from('hand_history')
    .select('*')
    .eq('table_id', table.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Strip hole cards for any other player who didn't reveal at showdown.
  // The requesting user always sees their own cards.
  const filtered = (history ?? []).map((row) => {
    const results = (row.player_results ?? {}) as Record<string, PlayerResult>
    const safeResults: Record<string, PlayerResult> = {}
    for (const [uid, r] of Object.entries(results)) {
      if (uid === user.id) {
        // Own cards: always include
        safeResults[uid] = r
      } else if (r.revealed) {
        // Other player who showed at showdown: include
        safeResults[uid] = r
      } else {
        // Other player who folded or won uncontested: strip cards
        safeResults[uid] = { ...r, holeCards: [] }
      }
    }
    return { ...row, player_results: safeResults }
  })

  return NextResponse.json({ history: filtered })
}
