# Player Experience — Design Spec
Date: 2026-05-10

## Goal
Add depth and engagement to the poker game for regular players without touching core game logic or stability. All features are additive and safe to ship independently.

## Features

### 1. Hand Strength Indicator
- **Where:** `ActionPanel.tsx` — shown in the top-right of the "Your Turn" banner
- **When:** Flop, turn, river phases only (preflop has no community cards to evaluate against)
- **How:** Call `evaluator.ts` with `holeCards + communityCards` on each render. Display hand rank as a color-coded badge.
- **Colors:** High card = gray, Pair = blue, Two Pair = indigo, Three of a Kind = green, Straight = teal, Flush = purple, Full House = orange, Quads = red, Straight Flush / Royal = gold
- **No DB required.** Pure client computation.

### 2. Pot Odds Display
- **Where:** `ActionPanel.tsx` — amber bar above the action buttons, only when there's a call to make (`callAmount > 0`)
- **Formula:** `requiredEquity = callAmount / (pot + callAmount)` expressed as a percentage
- **Display:** "Call 120 into pot of 480 → 20% equity needed"
- **No DB required.** Pure math from existing game state.

### 3. Hand History
- **DB:** New table `hand_history` — id, table_id, game_id, winner_user_ids (text[]), pot, community_cards (text[]), player_results (jsonb — userId → { holeCards, netChips, handRank }), created_at
- **Write:** At showdown in `src/app/api/games/[id]/action/route.ts` (both early fold and full showdown paths). Admin client writes to bypass RLS.
- **RLS:** `select` open to all; `insert` service-role only.
- **API:** `GET /api/tables/[code]/history?limit=10` — returns last 10 hands for the table, enriched with display_name from profiles.
- **UI:** `HandHistoryPanel.tsx` — slide-out from room page. Triggered by a "History" button in the room header. Shows W/L badge, hole cards, community cards, chip delta, and a stats summary bar (win %, hands played, net chips) computed from the returned rows filtered to the current user.

## Parallel Implementation Streams

| Agent | Files | Tests |
|---|---|---|
| Agent 1 | `ActionPanel.tsx`, `evaluator.ts` (read-only) | Unit test: evaluator partial boards; Playwright: badge visible on flop |
| Agent 2 | `004_hand_history.sql`, `action/route.ts`, `result/route.ts`, `HandHistoryPanel.tsx`, `room/[code]/page.tsx` | API test: history endpoint returns rows; Playwright: panel opens with hand rows |
| Agent 3 | `tests/integration-poker.spec.ts` | Full E2E: 2 players through preflop→flop→turn→river→showdown, verify hand history written |

## Success Criteria
- Hand strength badge appears on flop+ for the active player
- Pot odds bar appears only when facing a call
- Hand history table is populated after each completed hand
- History panel opens and shows at least the last hand played
- Integration test completes a full hand end-to-end using real API calls
