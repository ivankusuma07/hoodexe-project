import { describe, expect, it } from 'vitest';
import { formatNumber, formatQuote } from './format';

describe('formatNumber', () => {
  it('writes tiny numbers with subscript zeros instead of exponents', () => {
    expect(formatNumber(1.7e-9)).toBe('0.0₈17'); // 0.0000000017
    expect(formatNumber(1.81e-9)).toBe('0.0₈181');
    expect(formatNumber(2.45e-11)).toBe('0.0₁₀245');
    expect(formatNumber(-5.14e-13)).toBe('-0.0₁₂514');
    expect(formatNumber(0.00001)).toBe('0.0₄1'); // 0.00001
    expect(formatNumber(0.000099996)).toBe('0.0001'); // rounds up across the boundary
  });

  it('keeps ordinary numbers plain', () => {
    expect(formatNumber(0.000123)).toBe('0.000123');
    expect(formatNumber(0.0535)).toBe('0.0535');
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(2.912)).toBe('2.91');
    expect(formatNumber(1.23456, { maxDecimals: 4 })).toBe('1.2346');
    expect(formatNumber(17_700)).toBe('17.7K');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('formatQuote adds the unit', () => {
    expect(formatQuote(2.45e-11, 'ETH')).toBe('0.0₁₀245 ETH');
    expect(formatQuote(null, 'ETH')).toBe('—');
  });
});
