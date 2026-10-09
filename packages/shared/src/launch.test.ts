import { describe, expect, it } from 'vitest';
import { PONS_METADATA_CAPS } from './abi';
import { buildDescription, parseDescription, tickerSchema, truncateBytes } from './launch';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('on-chain description', () => {
  it('uses the brief format and parses back', () => {
    const d = buildDescription('x^n + y^n = z^n has no solutions for n > 2', 94, 'bafyabc');
    expect(d).toBe('∑ x^n + y^n = z^n has no solutions for n > 2\n— launched on hood.exe · rigor 94/100 · ipfs://bafyabc');
    expect(parseDescription(d)).toEqual({ statement: 'x^n + y^n = z^n has no solutions for n > 2', score: 94, cid: 'bafyabc' });
  });

  it('writes an em dash for an unscored launch', () => {
    const d = buildDescription('1 + 1 = 2', null, 'bafy');
    expect(d).toContain('rigor —/100');
    expect(parseDescription(d)?.score).toBeNull();
  });

  it('never exceeds the Pons description cap', () => {
    const d = buildDescription('∀ε>0 '.repeat(2_000), 50, 'bafy'.repeat(10));
    expect(bytes(d)).toBeLessThanOrEqual(PONS_METADATA_CAPS.description);
    expect(parseDescription(d)?.cid).toBe('bafy'.repeat(10));
  });

  it('ignores descriptions from other launchpads', () => {
    expect(parseDescription('The no liquidation fixed credit peer to peer credit protocol')).toBeNull();
  });
});

describe('truncateBytes', () => {
  it('does not split multi-byte characters', () => {
    const out = truncateBytes('∑∑∑∑∑', 8);
    expect(bytes(out)).toBeLessThanOrEqual(8);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('�');
  });
});

describe('tickerSchema', () => {
  it('uppercases and validates', () => {
    expect(tickerSchema.parse(' fermat ')).toBe('FERMAT');
    expect(tickerSchema.safeParse('A').success).toBe(false);
    expect(tickerSchema.safeParse('TOO-LONG').success).toBe(false);
    expect(tickerSchema.safeParse('ABCDEFGHIJK').success).toBe(false);
  });
});
