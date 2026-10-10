import { describe, expect, it } from 'vitest';
import {
  SCORE,
  applyMove,
  autoCompleteMoves,
  canPlaceOnFoundation,
  canStackOnTableau,
  createDeck,
  deal,
  displayScore,
  draw,
  foundationMove,
  isWon,
} from './solitaire.logic';
import { SUITS, type Card, type GameState, type Rank, type Suit } from './solitaire.types';

const card = (suit: Suit, rank: number, faceUp = true): Card => ({ suit, rank: rank as Rank, faceUp, id: `${suit[0]}${rank}` });
const t = (col: number) => ({ kind: 'tableau', col }) as const;
const f = (suit: Suit) => ({ kind: 'foundation', suit }) as const;
const waste = { kind: 'waste' } as const;

/** A hand-built position on top of a fresh deal. */
function position(over: Partial<GameState>): GameState {
  return { ...deal(1), stock: [], waste: [], foundations: { hearts: [], diamonds: [], clubs: [], spades: [] }, tableau: [[], [], [], [], [], [], []], ...over };
}

describe('rules', () => {
  it('canStackOnTableau: alternating colours, one rank lower; Kings only on empty columns', () => {
    expect(canStackOnTableau(card('hearts', 6), card('spades', 7))).toBe(true);
    expect(canStackOnTableau(card('clubs', 6), card('spades', 7))).toBe(false); // same colour
    expect(canStackOnTableau(card('hearts', 5), card('spades', 7))).toBe(false); // skips a rank
    expect(canStackOnTableau(card('hearts', 6), card('spades', 7, false))).toBe(false); // onto a face-down card
    expect(canStackOnTableau(card('spades', 13), undefined)).toBe(true);
    expect(canStackOnTableau(card('spades', 12), undefined)).toBe(false);
  });

  it('canPlaceOnFoundation: same suit, Ace first, one rank higher', () => {
    expect(canPlaceOnFoundation(card('hearts', 1), [])).toBe(true);
    expect(canPlaceOnFoundation(card('hearts', 2), [])).toBe(false);
    expect(canPlaceOnFoundation(card('hearts', 2), [card('hearts', 1)])).toBe(true);
    expect(canPlaceOnFoundation(card('diamonds', 2), [card('hearts', 1)])).toBe(false);
    expect(canPlaceOnFoundation(card('hearts', 3), [card('hearts', 1)])).toBe(false);
  });

  it('isWon: all four foundations hold 13 cards', () => {
    const full = Object.fromEntries(SUITS.map((s) => [s, Array.from({ length: 13 }, (_, i) => card(s, i + 1))])) as GameState['foundations'];
    expect(isWon(position({ foundations: full }))).toBe(true);
    expect(isWon(position({ foundations: { ...full, spades: full.spades.slice(0, 12) } }))).toBe(false);
  });
});

describe('deal', () => {
  it('lays out 7 columns of 1–7 cards with only the top face up, and 24 in the stock', () => {
    const g = deal(42);
    expect(g.tableau.map((c) => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const col of g.tableau) expect(col.map((c) => c.faceUp)).toEqual(col.map((_, i) => i === col.length - 1));
    expect(g.stock).toHaveLength(24);
    expect(g.stock.every((c) => !c.faceUp)).toBe(true);
    const ids = [...g.stock, ...g.tableau.flat()].map((c) => c.id);
    expect(new Set(ids).size).toBe(52);
    expect(new Set(ids)).toEqual(new Set(createDeck().map((c) => c.id)));
  });

  it('is the same for the same seed (Deal Again) and differs across seeds', () => {
    expect(deal(7)).toEqual(deal(7));
    expect(deal(7).stock.map((c) => c.id)).not.toEqual(deal(8).stock.map((c) => c.id));
  });

  it('matches the snapshot for seed 2026', () => {
    const g = deal(2026);
    expect({ tableau: g.tableau.map((col) => col.map((c) => `${c.id}${c.faceUp ? '' : '*'}`)), stock: g.stock.map((c) => c.id) }).toMatchSnapshot();
  });
});

describe('moves and scoring', () => {
  it('moves a run between columns and turns over the uncovered card (+5)', () => {
    const g = position({ tableau: [[card('clubs', 2, false), card('hearts', 9), card('spades', 8)], [card('clubs', 10)], [], [], [], [], []] });
    const next = applyMove(g, { from: t(0), index: 1, to: t(1) }, 1_000)!;
    expect(next.tableau[1].map((c) => c.id)).toEqual(['c10', 'h9', 's8']);
    expect(next.tableau[0]).toEqual([card('clubs', 2, true)]);
    expect(next.points).toBe(SCORE.turnOver);
    expect(next.moves).toBe(1);
    expect(next.startedAt).toBe(1_000);
  });

  it('refuses illegal moves', () => {
    const g = position({ tableau: [[card('hearts', 9)], [card('diamonds', 10)], [], [], [], [], []], waste: [card('spades', 4), card('clubs', 5)] });
    expect(applyMove(g, { from: t(0), index: 0, to: t(1) })).toBeNull(); // red on red
    expect(applyMove(g, { from: waste, index: 0, to: t(2) })).toBeNull(); // not the waste's top card
    expect(applyMove(g, { from: t(0), index: 0, to: f('hearts') })).toBeNull(); // 9 on an empty foundation
    expect(applyMove(g, { from: t(0), index: 0, to: t(0) })).toBeNull();
  });

  it('scores waste → tableau +10, waste → foundation +5, tableau → foundation +10, foundation → tableau −15', () => {
    let g = position({ waste: [card('hearts', 1), card('hearts', 6)], tableau: [[card('spades', 7)], [card('hearts', 2)], [card('clubs', 3)], [], [], [], []] });
    g = applyMove(g, { from: waste, index: 1, to: t(0) })!;
    expect(g.points).toBe(10);
    g = applyMove(g, { from: waste, index: 0, to: f('hearts') })!;
    expect(g.points).toBe(15);
    g = applyMove(g, { from: t(1), index: 0, to: f('hearts') })!;
    expect(g.points).toBe(25);
    g = applyMove(g, { from: f('hearts'), index: 1, to: t(2) })!;
    expect(g.points).toBe(10);
  });

  it('draws one card and recycles the waste (−15, never below zero)', () => {
    let g = position({ stock: [card('clubs', 3, false), card('clubs', 4, false)], points: 10 });
    g = draw(g)!;
    g = draw(g)!;
    expect(g.waste.map((c) => [c.id, c.faceUp])).toEqual([
      ['c4', true],
      ['c3', true],
    ]);
    g = draw(g)!;
    expect(g.stock.map((c) => c.id)).toEqual(['c3', 'c4']);
    expect(g.stock.every((c) => !c.faceUp)).toBe(true);
    expect(g.recycles).toBe(1);
    expect(g.points).toBe(0);
    expect(draw(position({}))).toBeNull();
  });

  it('applies the time penalty and the win bonus', () => {
    const g = position({ points: 100, startedAt: 0, finishedAt: null });
    expect(displayScore(g, 25_000)).toBe(96);
    expect(displayScore(g, 600_000)).toBe(0);
    expect(displayScore({ ...g, status: 'won', finishedAt: 100_000 }, 999_999)).toBe(80 + 7_000);
  });
});

describe('autocomplete', () => {
  it('finds the foundation move for a card', () => {
    const g = position({ tableau: [[card('spades', 1)], [], [], [], [], [], []] });
    expect(foundationMove(g, t(0), 0)).toEqual({ from: t(0), index: 0, to: f('spades') });
    expect(foundationMove(position({ tableau: [[card('spades', 2)], [], [], [], [], [], []] }), t(0), 0)).toBeNull();
  });

  it('autoCompleteMoves: returns a winning sequence once everything is face up', () => {
    // Two suits left on foundations at 11; the rest as descending runs in the tableau.
    const g = position({
      foundations: {
        hearts: Array.from({ length: 11 }, (_, i) => card('hearts', i + 1)),
        diamonds: Array.from({ length: 13 }, (_, i) => card('diamonds', i + 1)),
        clubs: Array.from({ length: 11 }, (_, i) => card('clubs', i + 1)),
        spades: Array.from({ length: 13 }, (_, i) => card('spades', i + 1)),
      },
      tableau: [[card('clubs', 13), card('hearts', 12)], [card('hearts', 13), card('clubs', 12)], [], [], [], [], []],
    });
    const moves = autoCompleteMoves(g)!;
    expect(moves).toHaveLength(4);
    let s = g;
    for (const m of moves) s = applyMove(s, m)!;
    expect(s.status).toBe('won');
    expect(s.finishedAt).not.toBeNull();
  });

  it('autoCompleteMoves: null while cards are face down or the stock has cards', () => {
    expect(autoCompleteMoves(deal(3))).toBeNull();
    expect(autoCompleteMoves(position({ stock: [card('clubs', 1, false)] }))).toBeNull();
  });
});
