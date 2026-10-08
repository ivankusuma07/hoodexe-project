import { RIGOR_DISCLAIMER, rigorTier } from '@hood/shared';
import styles from './RigorBadge.module.css';

export function RigorBadge({ score }: { score: number | null | undefined }) {
  const tier = rigorTier(score);
  return (
    <span className={`${styles.badge} ${styles[tier]}`} title={`Rigor score — ${RIGOR_DISCLAIMER}`}>
      ∑ {score == null ? '—' : score}
    </span>
  );
}
