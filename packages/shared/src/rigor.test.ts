import { describe, expect, it } from 'vitest';
import { normalizeStatement, rigorModelOutputSchema, rigorTier } from './rigor';

describe('rigorModelOutputSchema', () => {
  it('recomputes the score as the sum of the parts', () => {
    const r = rigorModelOutputSchema.parse({
      score: 99,
      well_formed: 24,
      status: 33,
      significance: 25,
      clarity: 12,
      status_label: 'proven',
      reasoning: 'Classical result.',
    });
    expect(r.score).toBe(94);
  });

  it('clamps parts that overshoot their range', () => {
    const r = rigorModelOutputSchema.parse({
      well_formed: 400,
      status: -3,
      significance: '20',
      clarity: 15.6,
      status_label: 'conjecture',
      reasoning: 'x'.repeat(500),
    });
    expect(r.parts).toEqual({ wellFormed: 25, status: 0, significance: 20, clarity: 15 });
    expect(r.reasoning).toHaveLength(200);
  });

  it('caps non-maths at 10 and survives junk labels', () => {
    const notMath = rigorModelOutputSchema.parse({
      well_formed: 20,
      status: 20,
      significance: 20,
      clarity: 15,
      status_label: 'not_math',
      reasoning: '',
    });
    expect(notMath.score).toBe(10);
    expect(rigorModelOutputSchema.parse({ status_label: 'banana' }).statusLabel).toBe('ill_posed');
  });
});

describe('helpers', () => {
  it('rigorTier', () => {
    expect([rigorTier(80), rigorTier(79), rigorTier(60), rigorTier(59), rigorTier(null)]).toEqual([
      'good',
      'warn',
      'warn',
      'bad',
      'none',
    ]);
  });

  it('normalizeStatement collapses whitespace but keeps case', () => {
    expect(normalizeStatement('  Let  X\n be   x ')).toBe('Let X be x');
  });
});
