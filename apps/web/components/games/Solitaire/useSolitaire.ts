'use client';

import { useCallback, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { applyMove, autoCompleteMoves, deal, displayScore, draw, elapsedSeconds, foundationMove, newSeed } from './solitaire.logic';
import type { GameState, Move, Pile } from './solitaire.types';

/** hood-exe-games-brief.md §2.9: everything lives in this browser only. */
const KEYS = { stats: 'solitaire:stats', settings: 'solitaire:settings', current: 'solitaire:current' } as const;
const UNDO_LIMIT = 100;

export type Stats = { gamesPlayed: number; wins: number; bestTime: number | null; bestMoves: number | null; bestScore: number | null; currentStreak: number };
export type Settings = { cardBack: 'blue' | 'red'; autoComplete: boolean };

const NO_STATS: Stats = { gamesPlayed: 0, wins: 0, bestTime: null, bestMoves: null, bestScore: null, currentStreak: 0 };
const DEFAULT_SETTINGS: Settings = { cardBack: 'blue', autoComplete: true };

// Storage can be missing or throw (private windows, blocked site data); the game plays the same without it.
function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved this time.
  }
}

/** A saved game is worth offering only if it was actually being played. */
function savedGame(): GameState | null {
  const g = load<GameState | null>(KEYS.current, null);
  return g && g.status === 'playing' && g.moves > 0 && Array.isArray(g.tableau) && g.tableau.length === 7 ? g : null;
}

export function useSolitaire() {
  const [state, setState] = useState<GameState>(() => deal(newSeed()));
  const [history, setHistory] = useState<GameState[]>([]);
  // Solitaire only renders in the browser (the desktop opens windows after it mounts), so storage is readable here.
  const [stats, setStats] = useState<Stats>(() => load(KEYS.stats, NO_STATS));
  const [settings, setSettingsState] = useState<Settings>(() => load(KEYS.settings, DEFAULT_SETTINGS));
  const [resumable, setResumable] = useState<GameState | null>(() => savedGame());
  const counted = useRef(false);

  const updateStats = useCallback((fn: (s: Stats) => Stats) => {
    setStats((cur) => {
      const next = fn(cur);
      save(KEYS.stats, next);
      return next;
    });
  }, []);

  /** Applies a new state with undo; counts the game as played on its first move and records a win. */
  const commit = useCallback(
    (prev: GameState, next: GameState) => {
      setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), prev]);
      setState(next);
      if (!counted.current && next.moves > 0) {
        counted.current = true;
        updateStats((s) => ({ ...s, gamesPlayed: s.gamesPlayed + 1 }));
      }
      if (next.status === 'won' && prev.status !== 'won') {
        const time = elapsedSeconds(next);
        const score = displayScore(next);
        updateStats((s) => ({
          ...s,
          wins: s.wins + 1,
          currentStreak: s.currentStreak + 1,
          bestTime: s.bestTime == null ? time : Math.min(s.bestTime, time),
          bestMoves: s.bestMoves == null ? next.moves : Math.min(s.bestMoves, next.moves),
          bestScore: s.bestScore == null ? score : Math.max(s.bestScore, score),
        }));
        track('solitaire_won', { time, moves: next.moves, score });
      }
      save(KEYS.current, next.status === 'playing' && next.moves > 0 ? next : null);
    },
    [updateStats],
  );

  const start = useCallback(
    (seed: number) => {
      // Walking away from a game in progress ends the winning streak.
      if (state.status === 'playing' && state.moves > 0) updateStats((s) => ({ ...s, currentStreak: 0 }));
      counted.current = false;
      setHistory([]);
      setState(deal(seed));
      setResumable(null);
      save(KEYS.current, null);
      track('solitaire_started');
    },
    [state, updateStats],
  );

  const newGame = useCallback(() => start(newSeed()), [start]);
  const dealAgain = useCallback(() => start(state.seed), [start, state.seed]);

  const doDraw = useCallback(() => {
    const next = draw(state);
    if (next) commit(state, next);
    return next != null;
  }, [state, commit]);

  const move = useCallback(
    (m: Move) => {
      const next = applyMove(state, m);
      if (next) commit(state, next);
      return next != null;
    },
    [state, commit],
  );

  const toFoundation = useCallback(
    (from: Pile, index: number) => {
      const m = foundationMove(state, from, index);
      return m ? move(m) : false;
    },
    [state, move],
  );

  const undo = useCallback(() => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    save(KEYS.current, prev.moves > 0 ? prev : null);
  }, [history]);

  /** The next autocomplete move, if the rest of the game can play itself (the board animates one per tick). */
  const autoStep = useCallback(() => {
    const moves = autoCompleteMoves(state);
    return moves?.length ? move(moves[0]) : false;
  }, [state, move]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((cur) => {
      const next = { ...cur, ...patch };
      save(KEYS.settings, next);
      return next;
    });
  }, []);

  const resume = useCallback(() => {
    if (!resumable) return;
    counted.current = true;
    setHistory([]);
    setState(resumable);
    setResumable(null);
  }, [resumable]);

  const declineResume = useCallback(() => {
    setResumable(null);
    save(KEYS.current, null);
    updateStats((s) => ({ ...s, currentStreak: 0 }));
  }, [updateStats]);

  return {
    state,
    stats,
    settings,
    resumable,
    canUndo: history.length > 0,
    newGame,
    dealAgain,
    draw: doDraw,
    move,
    toFoundation,
    undo,
    autoStep,
    setSettings,
    resume,
    declineResume,
  };
}
