'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GameState, ActionType, PokerTable, Profile, TableSeat, GameAction, WinnerResult } from '@/types';

export function useGameState(tableCode: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [table, setTable] = useState<PokerTable | null>(null);
  const [seats, setSeats] = useState<TableSeat[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cache profile — only fetch once; it changes rarely
  const profileRef = useRef<Profile | null>(null);
  // Debounce: prevent concurrent duplicate fetches (Realtime fires multiple events per action)
  const fetchingRef = useRef(false);
  const pendingFetchRef = useRef(false);
  // Stable client ref — createBrowserClient must not recreate on every render
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchGameState = useCallback(async () => {
    // If a fetch is already in flight, mark that another one is needed and return
    if (fetchingRef.current) {
      pendingFetchRef.current = true;
      return;
    }
    fetchingRef.current = true;
    pendingFetchRef.current = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const userId = user.id;

      // Fetch my profile only on first load (chip_balance refreshed after sendAction explicitly)
      if (!profileRef.current) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (profileData) {
          profileRef.current = profileData as Profile;
          setMyProfile(profileData as Profile);
        }
      }

      // Fetch table with seats + profiles
      const { data: tableData, error: tableError } = await supabase
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
        .eq('room_code', tableCode.toUpperCase())
        .single();

      if (tableError || !tableData) {
        setError('Table not found');
        setLoading(false);
        return;
      }

      const tableObj = tableData as PokerTable;
      const seatsArr = ((tableData.table_seats ?? []) as Array<TableSeat & { profile: Profile }>);

      // Always persist table + seats — needed even when no active game
      setTable(tableObj);
      setSeats(seatsArr);

      // Fetch the most recent game for this table
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('table_id', tableData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!gameData) {
        // No active game — table/seats are set, but no game state
        setGameState(null);
        setLoading(false);
        return;
      }

      // Fetch my hand
      const { data: myHandData } = await supabase
        .from('player_hands')
        .select('*')
        .eq('game_id', gameData.id)
        .eq('user_id', userId)
        .maybeSingle();

      // Fetch recent game actions
      const { data: actionsData } = await supabase
        .from('game_actions')
        .select('*')
        .eq('game_id', gameData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Find current player seat
      const currentPlayerSeat: TableSeat | null =
        (seatsArr.find((s) => s.user_id === gameData.current_player_id) as TableSeat) ?? null;

      const isMyTurn = gameData.current_player_id === userId;

      const state: GameState = {
        game: gameData,
        seats: seatsArr,
        myHand: myHandData ?? null,
        actions: (actionsData ?? []) as GameAction[],
        table: tableObj,
        currentPlayer: currentPlayerSeat,
        isMyTurn,
      };

      setGameState(state);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load game';
      setError(msg);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      // If another fetch was requested while this one was in flight, run it now
      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        fetchGameState();
      }
    }
  }, [tableCode]);

  useEffect(() => {
    fetchGameState();

    // Polling fallback every 15s — Realtime handles real-time updates; poll catches missed events
    const pollInterval = setInterval(fetchGameState, 15000);

    const channel = supabase
      .channel(`table:${tableCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => fetchGameState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_actions' },
        () => fetchGameState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_seats' },
        () => fetchGameState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_hands' },
        () => fetchGameState()
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [tableCode, fetchGameState]);

  const sendAction = useCallback(
    async (action: ActionType, amount?: number): Promise<{ winners: WinnerResult[]; losers: Array<{ userId: string; amount: number }>; playerCards: Record<string, string[]> } | null> => {
      if (!gameState) throw new Error('No active game');
      let res: Response;
      try {
        res = await fetch(`/api/games/${gameState.game.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, amount }),
        });
      } catch {
        throw new Error('Could not reach server — check your connection and try again');
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Action failed');
      }
      const json = await res.json().catch(() => ({}));

      if (json.winners) {
        // Hand ended — refresh profile for updated chip balance, then return results
        profileRef.current = null;
        await fetchGameState();
        return {
          winners: json.winners as WinnerResult[],
          losers: (json.losers ?? []) as Array<{ userId: string; amount: number }>,
          playerCards: (json.playerCards ?? {}) as Record<string, string[]>,
        };
      }

      // Mid-hand action: fire refetch immediately (non-blocking) — Realtime or explicit, first wins
      fetchGameState();
      return null;
    },
    [gameState, fetchGameState]
  );

  const fetchResult = useCallback(async (gameId: string): Promise<{ winners: WinnerResult[]; losers: Array<{ userId: string; amount: number }>; playerCards: Record<string, string[]> } | null> => {
    try {
      const res = await fetch(`/api/games/${gameId}/result`)
      if (!res.ok) return null
      const json = await res.json()
      if (!json.winners) return null
      return {
        winners: json.winners as WinnerResult[],
        losers: (json.losers ?? []) as Array<{ userId: string; amount: number }>,
        playerCards: (json.playerCards ?? {}) as Record<string, string[]>,
      }
    } catch {
      return null
    }
  }, [])

  const startGame = useCallback(async () => {
    const res = await fetch(`/api/tables/${tableCode}/start`, {
      method: 'POST',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? 'Failed to start game');
    }
    profileRef.current = null; // refresh chip balance
    await fetchGameState();
  }, [tableCode, fetchGameState]);

  return {
    gameState,
    table,
    seats,
    myProfile,
    loading,
    error,
    sendAction,
    startGame,
    fetchResult,
    refetch: fetchGameState,
  };
}
