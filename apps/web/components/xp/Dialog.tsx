'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CtrlGlyph } from './Window';
import { ErrorIcon, InfoIcon, QuestionIcon, WarningIcon } from './Icons';
import { Button } from './Button';
import styles from './Window.module.css';
import box from './Dialog.module.css';

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  dim?: boolean;
  /** Content for the dialog's own button row. */
  footer?: ReactNode;
};

export function Dialog({ title, onClose, children, width = 360, dim = true, footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('[data-autofocus], button:not([aria-label="Close"])')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={`${styles.overlay} ${dim ? styles.dim : ''}`} onPointerDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-label={title} className={`${styles.window} ${styles.dialog}`} style={{ width }}>
        <header className={styles.titlebar}>
          <span className={styles.title}>{title}</span>
          <span className={styles.controls}>
            <button type="button" className={`${styles.ctrl} ${styles.close}`} aria-label="Close" onClick={onClose}>
              <CtrlGlyph kind="close" />
            </button>
          </span>
        </header>
        <div className={box.content}>{children}</div>
        {footer && <div className={box.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const KIND_ICON = {
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
  question: QuestionIcon,
} as const;

type MessageBoxProps = {
  title: string;
  kind?: keyof typeof KIND_ICON;
  children: ReactNode;
  onClose: () => void;
  /** Defaults to a single OK button that closes. */
  buttons?: ReactNode;
  width?: number;
};

export function MessageBox({ title, kind = 'info', children, onClose, buttons, width }: MessageBoxProps) {
  const Icon = KIND_ICON[kind];
  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={width}
      footer={
        buttons ?? (
          <Button onClick={onClose} data-autofocus>
            OK
          </Button>
        )
      }
    >
      <div className={box.message}>
        <Icon size={32} />
        <div className={box.text}>{children}</div>
      </div>
    </Dialog>
  );
}
