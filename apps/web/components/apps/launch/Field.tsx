import type { ReactNode } from 'react';
import styles from './Launch.module.css';

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Characters used and allowed, shown next to the label. */
  count?: [number, number];
};

export function Field({ label, htmlFor, children, hint, error, count }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>
        <span>{label}</span>
        {count && (
          <span className={`${styles.counter} ${count[0] > count[1] ? styles.counterOver : ''}`}>
            {count[0]}/{count[1]}
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className={styles.error} id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}

/** aria + styling props for an input that may be invalid. */
export const invalidProps = (id: string, error: string | undefined) =>
  error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error`, className: styles.invalid } : {};
