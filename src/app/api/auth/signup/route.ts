import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { email, password, displayName } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Create user with email already confirmed (no verification email needed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { display_name: displayName || email.split('@')[0] },
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Sign in to get a session
    const supabase = await createServerClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      return NextResponse.json({ error: signInError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
