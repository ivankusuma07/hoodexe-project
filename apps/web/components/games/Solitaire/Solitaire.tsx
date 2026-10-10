'use client';

import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { movingCards, samePile } from './solitaire.logic';
import { SUITS, type Card, type GameState, type Move, type Pile, type Suit } from './solitaire.types';
import { CardView } from './Card';
import { WinCascade } from './WinCascade';
import styles from './solitaire.module.css';

/** Vertical step between stacked tableau cards, as a share of a card's height. */
const STEP_DOWN = 0.09;
const STEP_UP = 0.24;
const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_MS = 350;

type Drag = { from: Pile; index: number; ids: Set<string>; pointerId: number; x0: number; y0: number; dx: number; dy: number; moved: boolean };

type Props = {
  state: GameState;
  back: 'blue' | 'red';
  onDraw: () => boolean;
  onMove: (move: Move) => boolean;
  onFoundation: (from: Pile, index: number) => boolean;
  /** The win cascade finished (or was skipped). */
  onCelebrated: () => void;
  celebrated: boolean;
};

const pileKey = (p: Pile) => (p.kind === 'foundation' ? `f:${p.suit}` : p.kind === 'tableau' ? `t:${p.col}` : p.kind);

function parsePile(key: string | undefined): Pile | null {
  if (!key) return null;
  if (key === 'waste' || key === 'stock') return { kind: key };
  const [kind, v] = key.split(':');
  if (kind === 'f' && (SUITS as readonly string[]).includes(v)) return { kind: 'foundation', suit: v as Suit };
  if (kind === 't' && /^[0-6]$/.test(v)) return { kind: 'tableau', col: Number(v) };
  return null;
}

/** Klondike board (hood-exe-games-brief.md §2.2, §2.5): stock, waste, foundations and seven columns. */
export function SolitaireBoard({ state, back, onDraw, onMove, onFoundation, onCelebrated, celebrated }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [shaking, setShaking] = useState<Set<string>>(new Set());
  const lastTap = useRef<{ id: string; t: number } | null>(null);

  // Tableau cards that turned face up since the last position get the flip animation (not a fresh deal's).
  const faceUpIds = state.tableau.flat().filter((c) => c.faceUp).map((c) => c.id);
  const faceUpKey = faceUpIds.join(',');
  const [seen, setSeen] = useState(() => ({ key: faceUpKey, ids: new Set(faceUpIds), flipped: new Set<string>() }));
  if (seen.key !== faceUpKey) {
    setSeen({ key: faceUpKey, ids: new Set(faceUpIds), flipped: state.moves === 0 ? new Set() : new Set(faceUpIds.filter((id) => !seen.ids.has(id))) });
  }
  const flipped = seen.flipped;

  const shake = (ids: Iterable<string>) => {
    const set = new Set(ids);
    setShaking(set);
    window.setTimeout(() => setShaking((cur) => (cur === set ? new Set() : cur)), 320);
  };

  const onCardPointerDown = (e: PointerEvent<HTMLDivElement>, from: Pile, index: number) => {
    if (e.button !== 0 || state.status !== 'playing') return;
    const cards = movingCards(state, from, index);
    if (!cards) return;
    e.preventDefault();
    boardRef.current?.setPointerCapture(e.pointerId);
    setDrag({ from, index, ids: new Set(cards.map((c) => c.id)), pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    setDrag(null);
    if (d.moved) {
      // The pile under the pointer, ignoring the cards being carried.
      let to: Pile | null = null;
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        if (el.closest('[data-dragging]')) continue;
        to = parsePile(el.closest<HTMLElement>('[data-drop]')?.dataset.drop);
        if (to) break;
      }
      if (to && !samePile(to, d.from) && onMove({ from: d.from, index: d.index, to })) return;
      if (to && !samePile(to, d.from)) shake(d.ids);
      return;
    }
    // A tap: two on the same card send it to its foundation (double-click on a mouse, double-tap on touch).
    const id = [...d.ids][0];
    const now = e.timeStamp;
    if (lastTap.current?.id === id && now - lastTap.current.t < DOUBLE_TAP_MS) {
      lastTap.current = null;
      if (!onFoundation(d.from, d.index)) shake([id]);
    } else {
      lastTap.current = { id, t: now };
    }
  };

  const onContextMenu = (e: MouseEvent, from: Pile, index: number, id: string) => {
    e.preventDefault();
    if (!onFoundation(from, index)) shake([id]);
  };

  const renderCard = (card: Card, from: Pile, index: number, style?: CSSProperties) => {
    const dragging = drag?.ids.has(card.id);
    const cls = [dragging && drag?.moved ? styles.dragging : '', shaking.has(card.id) ? styles.shake : '', flipped.has(card.id) ? styles.flip : ''].join(' ');
    return (
      <CardView
        key={card.id}
        card={card}
        back={back}
        extraClass={cls}
        data-dragging={dragging ? '' : undefined}
        style={{ ...style, ...(dragging && drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : null) }}
        onPointerDown={card.faceUp ? (e) => onCardPointerDown(e, from, index) : undefined}
        onContextMenu={card.faceUp ? (e) => onContextMenu(e, from, index, card.id) : undefined}
      />
    );
  };

  const sourceKey = drag?.moved ? pileKey(drag.from) : null;
  const raised = (p: Pile): CSSProperties | undefined => (sourceKey === pileKey(p) ? { zIndex: 50 } : undefined);
  const topRaised = sourceKey === 'waste' || sourceKey?.startsWith('f:');

  return (
    <div className={styles.boardWrap}>
      <div ref={boardRef} className={styles.board} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        <div className={styles.top} style={topRaised ? { zIndex: 60 } : undefined}>
          <button
            type="button"
            className={styles.slot}
            data-pile="stock"
            onClick={() => onDraw()}
            aria-label={state.stock.length ? `Stock, ${state.stock.length} cards: deal one` : 'Turn the waste back over'}
          >
            {state.stock.length ? <CardView card={state.stock.at(-1)!} back={back} /> : <span className={styles.recycle}>↻</span>}
          </button>
          <div className={styles.slot} data-drop="waste" style={raised({ kind: 'waste' })}>
            {state.waste.slice(-2).map((c, i, shown) => renderCard(c, { kind: 'waste' }, state.waste.length - shown.length + i))}
          </div>
          <div aria-hidden="true" />
          {SUITS.map((suit) => {
            const pile: Pile = { kind: 'foundation', suit };
            const cards = state.foundations[suit];
            return (
              <div key={suit} className={styles.slot} data-drop={pileKey(pile)} data-foundation={suit} style={raised(pile)} aria-label={`${suit} foundation`}>
                <span className={styles.watermark}>{{ hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit]}</span>
                {cards.slice(-2).map((c, i, shown) => renderCard(c, pile, cards.length - shown.length + i))}
              </div>
            );
          })}
        </div>

        <div className={styles.tableau}>
          {state.tableau.map((col, ci) => {
            const pile: Pile = { kind: 'tableau', col: ci };
            let offset = 0;
            const tops = col.map((c) => {
              const top = offset;
              offset += c.faceUp ? STEP_UP : STEP_DOWN;
              return top;
            });
            const height = col.length ? tops.at(-1)! + 1 : 1;
            return (
              <div key={ci} className={styles.column} data-drop={pileKey(pile)} style={{ height: `calc(var(--ch) * ${height})`, ...raised(pile) }}>
                {col.map((c, i) => renderCard(c, pile, i, { top: `calc(var(--ch) * ${tops[i]})` }))}
              </div>
            );
          })}
        </div>

        {state.status === 'won' && !celebrated && <WinCascade board={boardRef} foundations={state.foundations} onDone={onCelebrated} />}
      </div>
    </div>
  );
}
