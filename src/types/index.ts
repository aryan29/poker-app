export type GamePhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'waiting';
export type PlayerStatus = 'active' | 'folded' | 'sitting_out' | 'eliminated' | 'all_in';
export type TableStatus = 'waiting' | 'playing' | 'finished';
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface Profile {
  id: string;
  display_name: string;
  chip_balance: number;
  created_at: string;
  updated_at: string;
}

export interface PokerTable {
  id: string;
  room_code: string;
  host_id: string;
  status: TableStatus;
  small_blind: number;
  big_blind: number;
  min_buyin: number;
  max_buyin: number;
  max_players: number;
  created_at: string;
}

export interface TableSeat {
  id: string;
  table_id: string;
  user_id: string;
  seat_number: number;
  stack: number;
  status: PlayerStatus;
  profile?: Profile;
}

export interface Game {
  id: string;
  table_id: string;
  phase: GamePhase;
  community_cards: string[];
  pot: number;
  round_pot: number;
  side_pots: Array<{ amount: number; eligiblePlayers: string[] }>;
  current_player_id: string | null;
  dealer_seat: number;
  current_bet: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerHand {
  id: string;
  game_id: string;
  user_id: string;
  hole_cards: string[];
  is_folded: boolean;
  current_bet: number;
  total_bet: number;
}

export interface GameAction {
  id: string;
  game_id: string;
  user_id: string;
  action: ActionType;
  amount: number;
  created_at: string;
}

export interface GameState {
  game: Game;
  seats: TableSeat[];
  myHand: PlayerHand | null;
  actions: GameAction[];
  table: PokerTable;
  isMyTurn: boolean;
  currentPlayer: TableSeat | null;
}

// Aliases for backwards compat across agents
export type Table = PokerTable;
export type PlayerAction = GameActionInput;
export type PlayerActionRequest = GameActionInput;
export type JoinTableRequest = { seat_number?: number; stack: number };
export type CreateTableRequest = CreateTableInput;

export interface CreateTableInput {
  small_blind: number;
  big_blind: number;
  min_buyin: number;
  max_buyin: number;
  max_players: number;
}

export interface GameActionInput {
  action: ActionType;
  amount?: number;
}

// ─── Card Types ──────────────────────────────────────────────────────────────

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  /** E.g. "Ah", "Kd", "Tc" */
  code: string;
}

export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface HandResult {
  rank: HandRank;
  rankValue: number;
  tiebreakers: number[];
  cards: Card[];
  description: string;
}

export interface WinnerResult {
  userId: string;
  handResult: HandResult;
  amount: number;
}
