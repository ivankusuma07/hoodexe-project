import { describe, expect, it } from 'vitest';
import { splitLatex } from './latex';

describe('splitLatex', () => {
  it('separates prose from inline maths', () => {
    expect(splitLatex('For $n > 2$, no solutions.')).toEqual([
      { kind: 'text', value: 'For ' },
      { kind: 'math', value: 'n > 2', display: false },
      { kind: 'text', value: ', no solutions.' },
    ]);
  });

  it('reads $$…$$ as display maths', () => {
    expect(splitLatex('$$e^{i\\pi} + 1 = 0$$')).toEqual([{ kind: 'math', value: 'e^{i\\pi} + 1 = 0', display: true }]);
  });

  it('keeps escaped and unclosed dollars as prose', () => {
    expect(splitLatex('costs \\$5')).toEqual([{ kind: 'text', value: 'costs $5' }]);
    expect(splitLatex('a $b')).toEqual([{ kind: 'text', value: 'a $b' }]);
    expect(splitLatex('$$')).toEqual([{ kind: 'text', value: '$$' }]);
  });

  it('does not end maths on an escaped dollar inside it', () => {
    expect(splitLatex('$a\\$b$')).toEqual([{ kind: 'math', value: 'a\\$b', display: false }]);
  });
});
