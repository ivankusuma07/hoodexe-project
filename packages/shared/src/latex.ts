export type LatexSegment = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

/**
 * Splits a theorem statement into prose and maths: `$…$` is inline maths, `$$…$$` display maths, `\$` a
 * literal dollar. An unclosed `$` stays prose. Only maths segments go to KaTeX; prose renders as text.
 */
export function splitLatex(input: string): LatexSegment[] {
  const out: LatexSegment[] = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) out.push({ kind: 'text', value: text });
    text = '';
  };
  while (i < input.length) {
    if (input.startsWith('\\$', i)) {
      text += '$';
      i += 2;
      continue;
    }
    if (input[i] === '$') {
      const display = input.startsWith('$$', i);
      const open = display ? 2 : 1;
      const close = findClose(input, i + open, display);
      if (close > i + open) {
        flush();
        out.push({ kind: 'math', value: input.slice(i + open, close), display });
        i = close + open;
        continue;
      }
    }
    text += input[i];
    i++;
  }
  flush();
  return out;
}

function findClose(s: string, from: number, display: boolean): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (display ? s.startsWith('$$', j) : s[j] === '$') return j;
  }
  return -1;
}
