# Poker App — Design Spec
**Date:** 2026-05-09  
**Status:** Approved  

## Overview
A real-time multiplayer Texas Hold'em poker web app. Players create a table, share a link, and friends join to play. P0 uses virtual chips; P1 adds real money via Stripe.

## Tech Stack
- **Frontend + API:** Next.js 14 (App Router, TypeScript)
- **Database + Auth + Realtime:** Supabase (PostgreSQL + Auth + Realtime Channels)
- **Styling:** Tailwind CSS + shadcn/ui
- **Deployment:** Vercel (frontend/API), Supabase cloud (backend)

## Core Modules (P0)

### 1. Auth
- Supabase Auth: email/password signup and login
- User profile: display name, avatar (generated from initials)
- Session persisted via Supabase client

### 2. Lobby
- Authenticated user can create a table
  - Set small blind, big blind, buy-in range, max players (2–9)
  - Gets shareable URL: `/room/[room_code]` (6-char alphanumeric code)
- Anyone with link can join (must be logged in)
- Lobby page shows active tables the user is part of

### 3. Game Engine (Server-Side)
- Texas Hold'em: preflop → flop → turn → river → showdown
- Cards dealt server-side via Next.js API routes (prevents cheating)
- Hole cards stored encrypted, visible only to the owning player (Supabase RLS)
- Actions: fold, check, call, raise (with validation server-side)
- Hand evaluation at showdown using standard poker hand rankings
- Pot split on ties, side pots for all-in scenarios (P0: simple pot, no side pots)
- Turn timer: 30 seconds per action, auto-fold on timeout

### 4. Real-time Table UI
- Supabase Realtime channel per table: game state broadcast to all players
- Poker table canvas: oval table, player seats with avatars, stacks, cards
- Community cards, pot size, dealer button, blind positions shown
- Action buttons appear only for the current player's turn
- Chat panel (text only, P0)
- Spectator mode for observers (join table without sitting)

### 5. Wallet (Virtual — P0)
- Each user has a `chip_balance` (starts at 10,000 virtual chips on signup)
- Buy-in deducts from balance; winning pot adds to balance
- "Top Up" button adds 10,000 chips (free, no payment P0)
- Balance visible in nav header at all times

## Database Schema

```sql
-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  display_name text not null,
  chip_balance bigint not null default 10000,
  created_at timestamptz default now()
);

-- Tables
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_id uuid references profiles,
  status text not null default 'waiting', -- waiting, playing, finished
  small_blind int not null default 10,
  big_blind int not null default 20,
  min_buyin int not null default 200,
  max_buyin int not null default 1000,
  max_players int not null default 9,
  created_at timestamptz default now()
);

-- Players at a table
create table public.table_seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables on delete cascade,
  user_id uuid references profiles,
  seat_number int not null, -- 0-8
  stack int not null,
  status text not null default 'active', -- active, folded, sitting_out, eliminated
  unique(table_id, seat_number),
  unique(table_id, user_id)
);

-- Game (one active game per table)
create table public.games (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables,
  phase text not null default 'preflop', -- preflop, flop, turn, river, showdown
  community_cards text[] default '{}',
  pot int not null default 0,
  current_player_id uuid references profiles,
  dealer_seat int not null default 0,
  deck_state text not null, -- shuffled deck (server-only column, RLS hidden)
  created_at timestamptz default now()
);

-- Hole cards (hidden from other players via RLS)
create table public.player_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games on delete cascade,
  user_id uuid references profiles,
  hole_cards text[] not null,
  is_folded bool default false
);

-- Actions log
create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games,
  user_id uuid references profiles,
  action text not null, -- fold, check, call, raise
  amount int default 0,
  created_at timestamptz default now()
);
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/tables | Create table, return room_code |
| POST | /api/tables/[code]/join | Join table at a seat |
| POST | /api/tables/[code]/start | Start game (host only) |
| POST | /api/games/[id]/action | Submit player action (fold/check/call/raise) |
| POST | /api/wallet/topup | Add 10k virtual chips |

## Realtime Events (Supabase Channels)

Channel name: `table:[room_code]`

| Event | Payload |
|-------|---------|
| `game_state` | Full game state (minus hidden cards) |
| `player_action` | Who did what |
| `hand_result` | Winner(s), winning hand, amount won |
| `player_joined` | New player at table |
| `player_left` | Player disconnected |

## Page Routes

```
/                     → Landing (login/signup CTA)
/lobby                → User's active tables + create table
/room/[code]          → Poker table (real-time game)
/profile              → Display name, chip balance, history
```

## Security
- All game mutations through API routes (never client-side state manipulation)
- Supabase RLS: players can only read their own hole cards
- `deck_state` column hidden from all clients via RLS
- Turn validation: server rejects actions from wrong player

## P1 Roadmap (Real Money)
- Stripe integration: deposit real money → converts to chips at 1:1 (1 chip = $0.01)
- Withdrawal flow with KYC verification
- Transaction ledger table for all money movements
- Legal: restricted to jurisdictions where online poker is legal

## Delivery & Deployment
- App deployed to Vercel (automatic from git push)
- Supabase project on free tier (sufficient for friends group)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
