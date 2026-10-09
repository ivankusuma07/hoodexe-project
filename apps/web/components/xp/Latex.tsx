'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { splitLatex } from '@hood/shared';
import styles from './Latex.module.css';

const KATEX_OPTIONS = { trust: false, maxExpand: 200, maxSize: 20, strict: 'ignore', throwOnError: true } as const;

/**
 * A theorem statement: prose renders as text, `$…$` maths through KaTeX (docs/BRIEF.md §4.5). KaTeX's
 * output is the only HTML we inject; with `trust: false` it escapes its input and allows no links,
 * classes or raw HTML. Maths that fails to parse shows as its source text.
 */
export function Latex({ source, className }: { source: string; className?: string }) {
  const parts = useMemo(
    () =>
      splitLatex(source).map((seg) => {
        if (seg.kind === 'text') return seg;
        try {
          return { ...seg, html: katex.renderToString(seg.value, { ...KATEX_OPTIONS, displayMode: seg.display }) };
        } catch (e) {
          return { ...seg, error: e instanceof Error ? e.message : 'Invalid LaTeX' };
        }
      }),
    [source],
  );

  return (
    <span className={`${styles.latex} ${className ?? ''}`}>
      {parts.map((p, i) => {
        if (p.kind === 'text') return <span key={i}>{p.value}</span>;
        if ('html' in p) return <span key={i} dangerouslySetInnerHTML={{ __html: p.html }} />;
        return (
          <code key={i} className={styles.error} title={p.error}>
            {p.display ? `$$${p.value}$$` : `$${p.value}$`}
          </code>
        );
      })}
    </span>
  );
}

/** Errors from the statement's maths segments, for the wizard's validation line. */
export function latexErrors(source: string): string[] {
  const errors: string[] = [];
  for (const seg of splitLatex(source)) {
    if (seg.kind !== 'math') continue;
    try {
      katex.renderToString(seg.value, { ...KATEX_OPTIONS, displayMode: seg.display });
    } catch (e) {
      errors.push(e instanceof Error ? e.message.replace(/^KaTeX parse error: /, '') : 'Invalid LaTeX');
    }
  }
  return errors;
}
