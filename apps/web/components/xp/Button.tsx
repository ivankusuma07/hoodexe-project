import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'default' | 'primary' | 'success' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  large?: boolean;
};

export function Button({ variant = 'default', large, className, type = 'button', ...rest }: ButtonProps) {
  const cls = [styles.btn, variant !== 'default' && styles[variant], large && styles.large, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
