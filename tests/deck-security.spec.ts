/**
 * deck-security.spec.ts
 *
 * Security regression test: verifies that a regular signed-in player CANNOT
 * read the poker deck (future cards) through any client-side mechanism.
 *
 * Background:
 *   Previously the shuffled deck was stored in `games.deck_state` which had
 *   a public RLS SELECT policy — meaning any signed-in player could query it
 *   via the Supabase JS client and see all upcoming community cards.
 *
 *   Migration 007 fixes this:
 *     1. New `game_decks` table with NO public RLS policies (denied by default
 *        for non-service-role users).
 *     2. The legacy `games.deck_state` column is now always empty (cleared,
 *        and never written to by application code).
 *     3. All deck reads/writes happen via the admin client in API routes.
 *
 * How this test works:
 *   We hit /api/debug/probe-deck which uses the SERVER (user-context) Supabase
 *   client — exactly what a regular player would have access to. Whatever rows
 *   come back is exactly what a player could see in their browser.
 *
 * Prerequisites:
 *   - Next.js dev server running on localhost:3000
 *   - Migration 007 applied to the Supabase database
 *
 * If migration 007 isn't applied yet, the assertions on `games.deck_state`
 * being empty may fail with non-empty deck strings — that's expected and
 * proves the test is doing its job.
 */

import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BASE_URL = 'http://localhost:3000'
const P1_EMAIL = 'apitest@pokergame.dev'
const P2_EMAIL = 'apitest2@pokergame.dev'
const PASSWORD = 'testpass123456'

// ---------------------------------------------------------------------------
// Helpers (copied from integration-poker.spec.ts to keep this file standalone)
// ---------------------------------------------------------------------------

async function ensureAccount(page: Page, email: string, displayName: string) {
  const signupRes = await page.request.post(`${BASE_URL}/api/auth/signup`, {
    data: { email, password: PASSWORD, displayName },
  })
  if (!signupRes.ok()) {
    const body = await signupRes.json().catch(() => ({}))
    const msg: string = (body as { error?: string }).error ?? ''
    if (!msg.toLowerCase().includes('already') && signupRes.status() !== 409) {
      throw new Error(`Unexpected signup error (${signupRes.status()}): ${msg}`)
    }
  }
}

async function signInPage(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page
    .getByRole('button', { name: 'Sign In' })
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL(`${BASE_URL}/lobby`, { timeout: 20000 })
}

async function ensureChips(page: Page, amount = 5000) {
  try {
    await page.request.post(`${BASE_URL}/api/wallet/topup`, { data: { amount } })
  } catch {
    // non-fatal
  }
}

async function createTable(page: Page): Promise<string> {
  const res = await page.request.post(`${BASE_URL}/api/tables`, {
    data: {
      small_blind: 10,
      big_blind: 20,
      min_buyin: 200,
      max_buyin: 1000,
      max_players: 9,
    },
  })
  const json = await res.json()
  if (!res.ok()) throw new Error((json as { error?: string }).error ?? 'createTable failed')
  return (json as { table: { room_code: string } }).table.room_code
}

async function joinTable(page: Page, code: string, buyinAmount: number, seatNumber: number) {
  const res = await page.request.post(`${BASE_URL}/api/tables/${code}/join`, {
    data: { buyin_amount: buyinAmount, stack: buyinAmount, seat_number: seatNumber },
  })
  const json = await res.json()
  if (!res.ok()) {
    const msg = (json as { error?: string }).error ?? 'joinTable failed'
    if (!msg.toLowerCase().includes('already seated') && res.status() !== 409) {
      throw new Error(msg)
    }
  }
}

async function startGame(page: Page, code: string): Promise<string> {
  const res = await page.request.post(`${BASE_URL}/api/tables/${code}/start`)
  const json = await res.json()
  if (!res.ok()) throw new Error((json as { error?: string }).error ?? 'startGame failed')
  const gameId =
    (json as { game?: { id?: string }; gameId?: string }).game?.id ??
    (json as { gameId?: string }).gameId
  if (!gameId) throw new Error('startGame: no game ID in response')
  return gameId
}

// ---------------------------------------------------------------------------
// Probe response shape
// ---------------------------------------------------------------------------

interface ProbeResponse {
  games: {
    rows: Array<{ id: string; deck_state: string | null }>
    error: string | null
  }
  game_decks: {
    rows: Array<{ game_id: string; deck_state: string | null }>
    error: string | null
  }
}

async function probeDeck(page: Page): Promise<ProbeResponse> {
  const res = await page.request.get(`${BASE_URL}/api/debug/probe-deck`)
  const status = res.status()
  const json = (await res.json().catch(() => ({}))) as ProbeResponse & { error?: string }
  if (status !== 200) {
    throw new Error(`probe-deck returned ${status}: ${(json as { error?: string }).error ?? ''}`)
  }
  return json
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Deck security — players cannot read future cards', () => {
  test('games.deck_state is empty and game_decks is unreadable for a signed-in user (no active game)', async ({
    page,
  }) => {
    // Just sign in as a regular player and probe — no game required.
    // Even with no game in progress, any historical games rows should have
    // empty deck_state (migration 007 cleared them), and game_decks should
    // be unreadable (RLS denies → returns either error or [] from supabase-js).
    await ensureAccount(page, P1_EMAIL, 'APITester')
    await signInPage(page, P1_EMAIL, PASSWORD)

    const probe = await probeDeck(page)

    // Assertion 1: games.deck_state is empty for every game visible to the user.
    // If migration 007's UPDATE ran, this is empty string. If a row leaks deck
    // data here, the security fix is broken or unmigrated.
    for (const row of probe.games.rows) {
      const deck = row.deck_state ?? ''
      if (deck.length > 0) {
        throw new Error(
          `SECURITY LEAK: games.deck_state on row ${row.id} returned ${deck.length} chars: "${deck.slice(0, 60)}..."`
        )
      }
      expect(deck).toBe('')
    }

    // Assertion 2: game_decks must return zero rows OR an RLS error.
    // RLS-denied tables in supabase-js typically return [] silently (no error),
    // so the strict check is rows.length === 0. If any row comes back with a
    // non-empty deck_state, that's a critical leak.
    for (const row of probe.game_decks.rows) {
      const deck = row.deck_state ?? ''
      if (deck.length > 0) {
        throw new Error(
          `SECURITY LEAK: game_decks returned readable deck (${deck.length} chars) for game ${row.game_id}: "${deck.slice(0, 60)}..."`
        )
      }
    }
    expect(probe.game_decks.rows.length).toBe(0)
  })

  test('with an active hand running, deck data is still NOT readable by players', async ({
    browser,
  }) => {
    // The strongest version of this test: actually start a real hand (so a
    // freshly-shuffled deck definitely exists somewhere in the database) and
    // then prove the probe still can't see it.
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      // 1. Two real signed-in players
      await ensureAccount(page1, P1_EMAIL, 'APITester')
      await ensureAccount(page2, P2_EMAIL, 'APITester2')
      await signInPage(page1, P1_EMAIL, PASSWORD)
      await signInPage(page2, P2_EMAIL, PASSWORD)
      await Promise.all([ensureChips(page1, 5000), ensureChips(page2, 5000)])

      // 2. Create + join + start a fresh game so a deck exists right now
      const code = await createTable(page1)
      await joinTable(page1, code, 500, 1)
      await joinTable(page2, code, 500, 2)
      const gameId = await startGame(page1, code)
      expect(gameId).toBeTruthy()

      // Brief settle time for any post-start writes to land
      await new Promise((r) => setTimeout(r, 250))

      // 3. Probe as a regular player — even with a hand actively running,
      //    nothing about the deck should be visible.
      const probe = await probeDeck(page1)

      // Confirm the probe at least sees the games row we just created
      // (sanity check: if RLS hides games entirely we'd be testing nothing).
      expect(probe.games.rows.length).toBeGreaterThan(0)

      // Assertion 1: every games.deck_state must be empty, including ours.
      for (const row of probe.games.rows) {
        const deck = row.deck_state ?? ''
        if (deck.length > 0) {
          throw new Error(
            `SECURITY LEAK during active hand: games.deck_state on row ${row.id} leaked ${deck.length} chars: "${deck.slice(0, 60)}..."`
          )
        }
        expect(deck).toBe('')
      }

      // Assertion 2: game_decks must be zero rows for the player.
      // The deck was just created server-side via the admin client, so it
      // exists in the DB — but RLS must hide it from a regular user.
      for (const row of probe.game_decks.rows) {
        const deck = row.deck_state ?? ''
        if (deck.length > 0) {
          throw new Error(
            `SECURITY LEAK during active hand: game_decks leaked deck (${deck.length} chars) for game ${row.game_id}: "${deck.slice(0, 60)}..."`
          )
        }
      }
      expect(probe.game_decks.rows.length).toBe(0)
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
