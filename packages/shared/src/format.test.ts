import { describe, expect, it } from 'vitest';
import { parseEther } from 'viem';
import { formatAmount, formatBps, shortAddress } from './format';

describe('formatAmount', () => {
  it('keeps small amounts precise and large ones short', () => {
    expect(formatAmount(parseEther('0.0005'), 18)).toBe('0.0005');
    expect(formatAmount(parseEther('4.2'), 18)).toBe('4.2');
    expect(formatAmount(28_199_566_160_520_607_375_271_149n, 18, { compact: true })).toBe('28.2M');
    expect(formatAmount(10_000_000n, 6)).toBe('10');
  });
});

describe('formatBps', () => {
  it('prints percentages', () => {
    expect(formatBps(100n)).toBe('1%');
    expect(formatBps(150)).toBe('1.5%');
  });
});

describe('shortAddress', () => {
  it('abbreviates', () => {
    expect(shortAddress('0x00000000000000000000000000000000000c0dE5')).toBe('0x0000…0dE5');
  });
});
