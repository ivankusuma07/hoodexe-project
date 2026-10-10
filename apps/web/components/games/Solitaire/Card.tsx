import type { CSSProperties, HTMLAttributes } from 'react';
import { RANK_LABEL, SUIT_SYMBOL, isRed } from './solitaire.logic';
import type { Card } from './solitaire.types';
import styles from './solitaire.module.css';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  card: Card;
  back: 'blue' | 'red';
  style?: CSSProperties;
  extraClass?: string;
};

/** One playing card, drawn with CSS and the four suit symbols (no image assets, renders on every platform). */
export function CardView({ card, back, style, extraClass = '', ...rest }: CardProps) {
  if (!card.faceUp) {
    return <div className={`${styles.card} ${styles.back} ${back === 'red' ? styles.backRed : styles.backBlue} ${extraClass}`} style={style} aria-label="Face-down card" {...rest} />;
  }
  const rank = RANK_LABEL[card.rank];
  const suit = SUIT_SYMBOL[card.suit];
  const name = `${rank === 'A' ? 'Ace' : rank === 'J' ? 'Jack' : rank === 'Q' ? 'Queen' : rank === 'K' ? 'King' : rank} of ${card.suit}`;
  return (
    <div className={`${styles.card} ${styles.face} ${isRed(card.suit) ? styles.red : ''} ${extraClass}`} style={style} aria-label={name} {...rest}>
      <span className={styles.corner}>
        {rank}
        <br />
        {suit}
      </span>
      <span className={styles.pip}>{card.rank > 10 ? rank : suit}</span>
      <span className={`${styles.corner} ${styles.cornerBottom}`}>
        {rank}
        <br />
        {suit}
      </span>
    </div>
  );
}
